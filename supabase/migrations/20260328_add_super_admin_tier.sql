-- Create super admin tier system
-- Tables: add is_super_admin to profiles, create audit logs and system settings

-- Add is_super_admin column to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS is_super_admin BOOLEAN DEFAULT FALSE;

-- Create index for quick super admin lookups
CREATE INDEX IF NOT EXISTS profiles_is_super_admin_idx
ON public.profiles(is_super_admin)
WHERE is_super_admin = TRUE;

-- Create super admin audit log table
CREATE TABLE IF NOT EXISTS public.super_admin_audit_log (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  super_admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text,
  target_id uuid,
  details jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_super_admin_id_idx
ON public.super_admin_audit_log(super_admin_id);
CREATE INDEX IF NOT EXISTS audit_log_created_at_idx
ON public.super_admin_audit_log(created_at);

-- Create system settings table
CREATE TABLE IF NOT EXISTS public.system_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key text NOT NULL UNIQUE,
  setting_value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

-- Add audit fields to schools
ALTER TABLE public.schools
ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS is_suspended BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- RLS Policy: Super admin can manage all schools
DROP POLICY IF EXISTS "Super admin manage all schools" ON public.schools;
CREATE POLICY "Super admin manage all schools" ON public.schools
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

-- RLS Policy: Super admin can view all profiles
DROP POLICY IF EXISTS "Super admin view all profiles" ON public.profiles;
CREATE POLICY "Super admin view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

-- RLS Policy: Super admin can update any profile
DROP POLICY IF EXISTS "Super admin update any profile" ON public.profiles;
CREATE POLICY "Super admin update any profile" ON public.profiles
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

-- Enable RLS on audit log table
ALTER TABLE public.super_admin_audit_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read audit logs" ON public.super_admin_audit_log
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admin insert audit logs" ON public.super_admin_audit_log
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

-- Enable RLS on system settings
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin read settings" ON public.system_settings
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

CREATE POLICY "Super admin update settings" ON public.system_settings
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );
