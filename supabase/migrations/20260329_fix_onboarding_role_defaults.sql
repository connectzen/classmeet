alter table public.profiles
alter column role drop default;

update public.profiles
set role = null,
    updated_at = now()
where onboarding_complete = false
  and school_id is null
  and coalesce(is_super_admin, false) = false
  and role = 'student';