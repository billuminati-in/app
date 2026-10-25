create function public.require_uid() returns uuid
language plpgsql stable set search_path = '' as $$
declare u uuid := (select auth.uid());
begin
  if u is null then raise exception 'Please sign in' using errcode = '28000'; end if;
  return u;
end $$;

-- Create a group; caller becomes owner; optional placeholder members
create function public.create_group(p_name text, p_currency text, p_members text[] default '{}')
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); gid uuid; n text;
begin
  insert into public.groups (name, currency, created_by)
  values (btrim(p_name), upper(btrim(p_currency)), uid) returning id into gid;
  insert into public.group_members (group_id, user_id, name, role)
  values (gid, uid, left(public.my_name(), 40), 'owner');
  foreach n in array coalesce(p_members, '{}') loop
    if char_length(btrim(n)) > 0 then
      insert into public.group_members (group_id, name) values (gid, left(btrim(n), 40));
    end if;
  end loop;
  perform public.log_activity(gid, 'group_created', jsonb_build_object('name', btrim(p_name)));
  return gid;
end $$;

create function public.add_member(p_group uuid, p_name text)
returns uuid language plpgsql security definer set search_path = '' as $$
declare mid uuid;
begin
  perform public.require_uid();
  if not public.is_member(p_group) then raise exception 'Not a member of this group'; end if;
  insert into public.group_members (group_id, name) values (p_group, left(btrim(p_name), 40)) returning id into mid;
  perform public.log_activity(p_group, 'member_added', jsonb_build_object('name', btrim(p_name)));
  return mid;
end $$;

create function public.remove_member(p_member uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare m public.group_members;
begin
  perform public.require_uid();
  select * into m from public.group_members where id = p_member;
  if m.id is null or not public.is_member(m.group_id) then raise exception 'Member not found'; end if;
  if m.user_id is not null then raise exception 'Only people who haven''t joined yet can be removed'; end if;
  if exists (select 1 from public.expenses where paid_by = m.id)
     or exists (select 1 from public.expense_splits where member_id = m.id)
     or exists (select 1 from public.settlements where from_member = m.id or to_member = m.id) then
    raise exception '% is part of expenses, so they can''t be removed', m.name;
  end if;
  delete from public.group_members where id = m.id;
  perform public.log_activity(m.group_id, 'member_removed', jsonb_build_object('name', m.name));
end $$;

-- Create or update an expense with its splits, atomically and validated
create function public.save_expense(
  p_group uuid, p_id uuid, p_description text, p_amount bigint, p_paid_by uuid,
  p_method text, p_spent_on date, p_splits jsonb)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); eid uuid := p_id; tot bigint; pct numeric; cnt int; bad int; old public.expenses;
begin
  if not public.is_member(p_group) then raise exception 'Not a member of this group'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  if p_method not in ('equal','percent','exact') then raise exception 'Unknown split method'; end if;
  if not exists (select 1 from public.group_members where id = p_paid_by and group_id = p_group) then
    raise exception 'Payer is not in this group'; end if;
  if jsonb_typeof(p_splits) <> 'array' or jsonb_array_length(p_splits) = 0 then
    raise exception 'Pick at least one person to split with'; end if;

  select count(*), coalesce(sum((s->>'share')::bigint), 0), sum((s->>'percent')::numeric),
         count(*) filter (where (s->>'share')::bigint < 0
                          or not exists (select 1 from public.group_members gm
                                         where gm.id = (s->>'member_id')::uuid and gm.group_id = p_group))
    into cnt, tot, pct, bad
  from jsonb_array_elements(p_splits) s;
  if bad > 0 then raise exception 'Split includes someone outside the group'; end if;
  if cnt <> (select count(distinct s->>'member_id') from jsonb_array_elements(p_splits) s) then
    raise exception 'Someone is listed twice in the split'; end if;
  if tot <> p_amount then raise exception 'Shares add up to % but the amount is %', tot, p_amount; end if;
  if p_method = 'percent' and (pct is null or abs(pct - 100) > 0.01) then
    raise exception 'Percentages must add up to 100'; end if;

  if eid is null then
    insert into public.expenses (group_id, description, amount, paid_by, split_method, spent_on, created_by)
    values (p_group, btrim(p_description), p_amount, p_paid_by, p_method, coalesce(p_spent_on, current_date), uid)
    returning id into eid;
    perform public.log_activity(p_group, 'expense_added',
      jsonb_build_object('expense_id', eid, 'description', btrim(p_description), 'amount', p_amount));
  else
    select * into old from public.expenses where id = eid and group_id = p_group for update;
    if old.id is null then raise exception 'Expense not found'; end if;
    if old.created_by is distinct from uid and not public.is_owner(p_group) then
      raise exception 'Only the person who added this expense, or the group owner, can edit it'; end if;
    update public.expenses set description = btrim(p_description), amount = p_amount, paid_by = p_paid_by,
      split_method = p_method, spent_on = coalesce(p_spent_on, old.spent_on), updated_at = now()
    where id = eid;
    delete from public.expense_splits where expense_id = eid;
    perform public.log_activity(p_group, 'expense_edited',
      jsonb_build_object('expense_id', eid, 'description', btrim(p_description), 'amount', p_amount,
                         'old_amount', old.amount, 'old_description', old.description));
  end if;

  insert into public.expense_splits (expense_id, member_id, share, percent)
  select eid, (s->>'member_id')::uuid, (s->>'share')::bigint, nullif(s->>'percent', '')::numeric
  from jsonb_array_elements(p_splits) s;
  return eid;
end $$;

create function public.delete_expense(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); e public.expenses;
begin
  select * into e from public.expenses where id = p_id;
  if e.id is null or not public.is_member(e.group_id) then raise exception 'Expense not found'; end if;
  if e.created_by is distinct from uid and not public.is_owner(e.group_id) then
    raise exception 'Only the person who added this expense, or the group owner, can delete it'; end if;
  delete from public.expenses where id = p_id;
  perform public.log_activity(e.group_id, 'expense_deleted',
    jsonb_build_object('description', e.description, 'amount', e.amount));
end $$;

create function public.record_settlement(p_group uuid, p_from uuid, p_to uuid, p_amount bigint,
  p_on date default current_date, p_note text default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); sid uuid; fn text; tn text;
begin
  if not public.is_member(p_group) then raise exception 'Not a member of this group'; end if;
  if p_amount is null or p_amount <= 0 then raise exception 'Amount must be more than zero'; end if;
  select name into fn from public.group_members where id = p_from and group_id = p_group;
  select name into tn from public.group_members where id = p_to and group_id = p_group;
  if fn is null or tn is null then raise exception 'Both people must be in this group'; end if;
  if p_from = p_to then raise exception 'Pick two different people'; end if;
  insert into public.settlements (group_id, from_member, to_member, amount, settled_on, note, created_by)
  values (p_group, p_from, p_to, p_amount, coalesce(p_on, current_date), nullif(btrim(p_note), ''), uid)
  returning id into sid;
  perform public.log_activity(p_group, 'settled', jsonb_build_object('from', fn, 'to', tn, 'amount', p_amount));
  return sid;
end $$;

create function public.delete_settlement(p_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); s public.settlements; fn text; tn text;
begin
  select * into s from public.settlements where id = p_id;
  if s.id is null or not public.is_member(s.group_id) then raise exception 'Payment not found'; end if;
  if s.created_by is distinct from uid and not public.is_owner(s.group_id) then
    raise exception 'Only the person who recorded this payment, or the group owner, can delete it'; end if;
  select name into fn from public.group_members where id = s.from_member;
  select name into tn from public.group_members where id = s.to_member;
  delete from public.settlements where id = p_id;
  perform public.log_activity(s.group_id, 'settlement_deleted', jsonb_build_object('from', fn, 'to', tn, 'amount', s.amount));
end $$;

-- Invite preview: anyone with the link sees the group name; signed-in users also see unclaimed names
create function public.get_invite(p_code text)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare g public.groups; uid uuid := (select auth.uid());
begin
  select * into g from public.groups where invite_code = p_code;
  if g.id is null then return null; end if;
  return jsonb_build_object(
    'group_id', g.id, 'name', g.name, 'currency', g.currency,
    'member_count', (select count(*) from public.group_members where group_id = g.id),
    'already_member', uid is not null and public.is_member(g.id),
    'unclaimed', case when uid is null then '[]'::jsonb else coalesce((
      select jsonb_agg(jsonb_build_object('id', id, 'name', name) order by created_at)
      from public.group_members where group_id = g.id and user_id is null), '[]'::jsonb) end);
end $$;

create function public.join_group(p_code text, p_claim uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); g public.groups; mname text;
begin
  select * into g from public.groups where invite_code = p_code;
  if g.id is null then raise exception 'This invite link is no longer valid'; end if;
  if public.is_member(g.id) then return g.id; end if;
  if p_claim is not null then
    update public.group_members set user_id = uid
    where id = p_claim and group_id = g.id and user_id is null
    returning name into mname;
    if mname is null then raise exception 'That name was already claimed by someone else'; end if;
  else
    mname := left(public.my_name(), 40);
    insert into public.group_members (group_id, user_id, name) values (g.id, uid, mname);
  end if;
  perform public.log_activity(g.id, 'member_joined', jsonb_build_object('name', mname));
  return g.id;
end $$;

create function public.reset_invite(p_group uuid)
returns text language plpgsql security definer set search_path = '' as $$
declare code text;
begin
  perform public.require_uid();
  if not public.is_owner(p_group) then raise exception 'Only the group owner can reset the invite link'; end if;
  update public.groups set invite_code = translate(encode(extensions.gen_random_bytes(9), 'base64'), '+/', '-_')
  where id = p_group returning invite_code into code;
  return code;
end $$;

create function public.leave_group(p_group uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare uid uuid := public.require_uid(); m public.group_members;
begin
  select * into m from public.group_members where group_id = p_group and user_id = uid;
  if m.id is null then raise exception 'You are not in this group'; end if;
  if m.role = 'owner' then raise exception 'The owner can''t leave; delete the group instead'; end if;
  -- keep their name and history in the group, just unlink the account
  update public.group_members set user_id = null where id = m.id;
  perform public.log_activity(p_group, 'member_left', jsonb_build_object('name', m.name));
end $$;

-- Execute rights
revoke execute on all functions in schema public from public, anon;
grant execute on function public.create_group, public.add_member, public.remove_member, public.save_expense,
  public.delete_expense, public.record_settlement, public.delete_settlement, public.get_invite,
  public.join_group, public.reset_invite, public.leave_group, public.is_member, public.is_owner,
  public.shares_group to authenticated;
grant execute on function public.get_invite to anon;
revoke execute on function public.handle_new_user, public.log_activity, public.my_name from authenticated;

-- Realtime: group screens refresh live
alter publication supabase_realtime add table public.groups, public.group_members, public.expenses,
  public.settlements, public.activity;
