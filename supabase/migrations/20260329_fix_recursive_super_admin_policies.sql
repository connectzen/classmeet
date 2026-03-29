create or replace function public.is_current_user_super_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles
    where id = auth.uid()
      and is_super_admin = true
  );
$$;

grant execute on function public.is_current_user_super_admin() to authenticated;
grant execute on function public.is_current_user_super_admin() to anon;

drop policy if exists "Super admin manage all schools" on public.schools;
create policy "Super admin manage all schools" on public.schools
  for all using (public.is_current_user_super_admin());

drop policy if exists "Super admin view all profiles" on public.profiles;
create policy "Super admin view all profiles" on public.profiles
  for select using (public.is_current_user_super_admin());

drop policy if exists "Super admin update any profile" on public.profiles;
create policy "Super admin update any profile" on public.profiles
  for update using (public.is_current_user_super_admin());

drop policy if exists "Super admin read audit logs" on public.super_admin_audit_log;
create policy "Super admin read audit logs" on public.super_admin_audit_log
  for select using (public.is_current_user_super_admin());

drop policy if exists "Super admin insert audit logs" on public.super_admin_audit_log;
create policy "Super admin insert audit logs" on public.super_admin_audit_log
  for insert with check (public.is_current_user_super_admin());

drop policy if exists "Super admin read settings" on public.system_settings;
create policy "Super admin read settings" on public.system_settings
  for select using (public.is_current_user_super_admin());

drop policy if exists "Super admin update settings" on public.system_settings;
create policy "Super admin update settings" on public.system_settings
  for all using (public.is_current_user_super_admin());