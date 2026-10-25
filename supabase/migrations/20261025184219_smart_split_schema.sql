-- ============ Tables ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  email text,
  created_at timestamptz not null default now()
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 60),
  currency text not null default 'SAR' check (currency ~ '^[A-Z]{3}$'),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  invite_code text not null unique default translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_'),
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  name text not null check (char_length(btrim(name)) between 1 and 40),
  role text not null default 'member' check (role in ('owner','member')),
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);
create index group_members_user_idx on public.group_members(user_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  description text not null check (char_length(btrim(description)) between 1 and 80),
  amount bigint not null check (amount > 0),
  paid_by uuid not null references public.group_members(id),
  split_method text not null check (split_method in ('equal','percent','exact')),
  spent_on date not null default current_date,
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_group_idx on public.expenses(group_id, spent_on desc, created_at desc);
create index expenses_paid_by_idx on public.expenses(paid_by);
create index expenses_created_by_idx on public.expenses(created_by);

create table public.expense_splits (
  expense_id uuid not null references public.expenses(id) on delete cascade,
  member_id uuid not null references public.group_members(id),
  share bigint not null check (share >= 0),
  percent numeric(7,3),
  primary key (expense_id, member_id)
);
create index expense_splits_member_idx on public.expense_splits(member_id);

create table public.settlements (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  from_member uuid not null references public.group_members(id),
  to_member uuid not null references public.group_members(id),
  amount bigint not null check (amount > 0),
  settled_on date not null default current_date,
  note text check (char_length(note) <= 120),
  created_by uuid references public.profiles(id) on delete set null default auth.uid(),
  created_at timestamptz not null default now(),
  check (from_member <> to_member)
);
create index settlements_group_idx on public.settlements(group_id, settled_on desc);
create index settlements_from_idx on public.settlements(from_member);
create index settlements_to_idx on public.settlements(to_member);
create index settlements_created_by_idx on public.settlements(created_by);

create table public.activity (
  id bigint generated always as identity primary key,
  group_id uuid not null references public.groups(id) on delete cascade,
  actor uuid references public.profiles(id) on delete set null,
  kind text not null,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index activity_group_idx on public.activity(group_id, created_at desc);
create index activity_actor_idx on public.activity(actor);
create index groups_created_by_idx on public.groups(created_by);

-- ============ Helpers ============
create function public.is_member(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
                 where group_id = gid and user_id = (select auth.uid()));
$$;

create function public.is_owner(gid uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members
                 where group_id = gid and user_id = (select auth.uid()) and role = 'owner');
$$;

create function public.shares_group(other uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.group_members a
                 join public.group_members b on a.group_id = b.group_id
                 where a.user_id = (select auth.uid()) and b.user_id = other);
$$;

create function public.my_name() returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(display_name), ''), split_part(email, '@', 1), 'Me')
  from public.profiles where id = (select auth.uid());
$$;

create function public.log_activity(gid uuid, k text, d jsonb) returns void
language sql security definer set search_path = '' as $$
  insert into public.activity(group_id, actor, kind, data)
  values (gid, (select auth.uid()), k, coalesce(d, '{}'::jsonb) || jsonb_build_object('by', public.my_name()));
$$;

-- New auth user -> profile
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id,
          left(coalesce(nullif(btrim(new.raw_user_meta_data->>'display_name'), ''), split_part(new.email, '@', 1)), 60),
          new.email);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Currency can't change once money is recorded (amounts are stored in minor units)
create function public.guard_group_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.currency <> old.currency and exists (select 1 from public.expenses where group_id = old.id) then
    raise exception 'Currency can''t be changed after expenses are added';
  end if;
  return new;
end $$;
create trigger groups_guard before update on public.groups
  for each row execute function public.guard_group_update();

-- ============ RLS ============
alter table public.profiles enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.expenses enable row level security;
alter table public.expense_splits enable row level security;
alter table public.settlements enable row level security;
alter table public.activity enable row level security;

create policy "profiles: self or groupmates" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or public.shares_group(id));
create policy "profiles: update self" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

create policy "groups: members read" on public.groups for select to authenticated
  using (public.is_member(id));
create policy "groups: owner updates" on public.groups for update to authenticated
  using (public.is_owner(id)) with check (public.is_owner(id));
create policy "groups: owner deletes" on public.groups for delete to authenticated
  using (public.is_owner(id));

create policy "members: members read" on public.group_members for select to authenticated
  using (public.is_member(group_id));
create policy "members: rename" on public.group_members for update to authenticated
  using (public.is_member(group_id) and (user_id is null or user_id = (select auth.uid()) or public.is_owner(group_id)))
  with check (public.is_member(group_id));

create policy "expenses: members read" on public.expenses for select to authenticated
  using (public.is_member(group_id));
create policy "splits: members read" on public.expense_splits for select to authenticated
  using (exists (select 1 from public.expenses e where e.id = expense_id and public.is_member(e.group_id)));
create policy "settlements: members read" on public.settlements for select to authenticated
  using (public.is_member(group_id));
create policy "activity: members read" on public.activity for select to authenticated
  using (public.is_member(group_id));

-- Lock down direct writes: everything else goes through checked functions
revoke all on public.profiles, public.groups, public.group_members, public.expenses,
  public.expense_splits, public.settlements, public.activity from anon;
revoke insert, update, delete on public.groups, public.group_members, public.expenses,
  public.expense_splits, public.settlements, public.activity, public.profiles from authenticated;
grant update (display_name) on public.profiles to authenticated;
grant update (name, currency) on public.groups to authenticated;
grant delete on public.groups to authenticated;
grant update (name) on public.group_members to authenticated;
grant select on public.profiles, public.groups, public.group_members, public.expenses,
  public.expense_splits, public.settlements, public.activity to authenticated;
