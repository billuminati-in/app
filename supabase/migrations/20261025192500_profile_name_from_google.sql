-- Google sign-ins send the name as full_name / name rather than display_name
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, email)
  values (new.id,
          left(coalesce(
            nullif(btrim(new.raw_user_meta_data->>'display_name'), ''),
            nullif(btrim(new.raw_user_meta_data->>'full_name'), ''),
            nullif(btrim(new.raw_user_meta_data->>'name'), ''),
            split_part(new.email, '@', 1)), 60),
          new.email);
  return new;
end $$;
