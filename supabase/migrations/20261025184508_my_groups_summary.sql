-- Home screen summary; runs with the caller's rights, so RLS limits it to their groups
create function public.my_groups()
returns table (id uuid, name text, currency text, member_count int, total bigint,
               my_balance bigint, owing_count int, created_at timestamptz)
language sql stable security invoker set search_path = '' as $$
  with nets as (
    select m.group_id, m.user_id,
      coalesce((select sum(e.amount) from public.expenses e where e.paid_by = m.id), 0)
      - coalesce((select sum(s.share) from public.expense_splits s where s.member_id = m.id), 0)
      + coalesce((select sum(t.amount) from public.settlements t where t.from_member = m.id), 0)
      - coalesce((select sum(t.amount) from public.settlements t where t.to_member = m.id), 0) as net
    from public.group_members m)
  select g.id, g.name, g.currency,
    (select count(*) from public.group_members m where m.group_id = g.id)::int,
    coalesce((select sum(e.amount) from public.expenses e where e.group_id = g.id), 0)::bigint,
    coalesce((select n.net from nets n where n.group_id = g.id and n.user_id = (select auth.uid())), 0)::bigint,
    (select count(*) from nets n where n.group_id = g.id and n.net < 0)::int,
    g.created_at
  from public.groups g
  order by g.created_at desc;
$$;
grant execute on function public.my_groups to authenticated;
