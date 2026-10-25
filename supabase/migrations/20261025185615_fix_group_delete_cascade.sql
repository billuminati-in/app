-- Members are only deleted by remove_member (which first checks they have no history)
-- or when the whole group is deleted, so cascading is safe and lets group deletion work.
alter table public.expense_splits drop constraint expense_splits_member_id_fkey,
  add constraint expense_splits_member_id_fkey foreign key (member_id) references public.group_members(id) on delete cascade;
alter table public.expenses drop constraint expenses_paid_by_fkey,
  add constraint expenses_paid_by_fkey foreign key (paid_by) references public.group_members(id) on delete cascade;
alter table public.settlements drop constraint settlements_from_member_fkey,
  add constraint settlements_from_member_fkey foreign key (from_member) references public.group_members(id) on delete cascade;
alter table public.settlements drop constraint settlements_to_member_fkey,
  add constraint settlements_to_member_fkey foreign key (to_member) references public.group_members(id) on delete cascade;
