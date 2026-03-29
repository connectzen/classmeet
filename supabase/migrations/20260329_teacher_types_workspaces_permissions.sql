-- ============================================================
-- 1. Add teacher_type and invited_by columns to profiles
-- ============================================================
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS teacher_type text CHECK (teacher_type IN ('independent', 'school_employed', 'collaborator')),
ADD COLUMN IF NOT EXISTS invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS profiles_teacher_type_idx ON public.profiles(teacher_type);
CREATE INDEX IF NOT EXISTS profiles_invited_by_idx ON public.profiles(invited_by);

-- Backfill existing teachers
UPDATE public.profiles
SET teacher_type = CASE
  WHEN school_id IS NOT NULL THEN 'school_employed'
  ELSE 'independent'
END,
updated_at = now()
WHERE role = 'teacher' AND teacher_type IS NULL;

-- ============================================================
-- 2. Create teacher_workspaces table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teacher_workspaces (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#818cf8',
  welcome_message text,
  email_template_name text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS teacher_workspaces_slug_idx ON public.teacher_workspaces(slug);
CREATE INDEX IF NOT EXISTS teacher_workspaces_teacher_id_idx ON public.teacher_workspaces(teacher_id);

-- RLS for teacher_workspaces
ALTER TABLE public.teacher_workspaces ENABLE ROW LEVEL SECURITY;

-- Owner can do everything with their workspace
CREATE POLICY "Owner manages own workspace" ON public.teacher_workspaces
  FOR ALL USING (teacher_id = auth.uid());

-- Collaborators and students of the teacher can read the workspace (for branding)
CREATE POLICY "Connected users can read workspace" ON public.teacher_workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.teacher_students ts
      WHERE ts.teacher_id = teacher_workspaces.teacher_id
      AND (ts.student_id = auth.uid() OR ts.teacher_id = auth.uid())
    )
  );

-- Super admins can read all workspaces
CREATE POLICY "Super admin read all workspaces" ON public.teacher_workspaces
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );

-- ============================================================
-- 3. Create teacher_permissions table
-- ============================================================
CREATE TABLE IF NOT EXISTS public.teacher_permissions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  granted_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission text NOT NULL CHECK (permission IN (
    'invite_students',
    'invite_teachers',
    'create_groups',
    'create_courses',
    'create_sessions',
    'manage_quizzes',
    'manage_settings'
  )),
  created_at timestamptz DEFAULT now(),
  UNIQUE(teacher_id, permission)
);

CREATE INDEX IF NOT EXISTS teacher_permissions_teacher_id_idx ON public.teacher_permissions(teacher_id);
CREATE INDEX IF NOT EXISTS teacher_permissions_granted_by_idx ON public.teacher_permissions(granted_by);

-- RLS for teacher_permissions
ALTER TABLE public.teacher_permissions ENABLE ROW LEVEL SECURITY;

-- Teachers can read their own permissions
CREATE POLICY "Teachers read own permissions" ON public.teacher_permissions
  FOR SELECT USING (teacher_id = auth.uid());

-- Grantors can manage permissions they granted
CREATE POLICY "Grantors manage granted permissions" ON public.teacher_permissions
  FOR ALL USING (granted_by = auth.uid());

-- Independent teachers can manage permissions for their collaborators
CREATE POLICY "Independent teachers manage collab permissions" ON public.teacher_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'teacher'
      AND profiles.teacher_type = 'independent'
    )
    AND EXISTS (
      SELECT 1 FROM public.teacher_students ts
      WHERE ts.teacher_id = auth.uid()
      AND ts.student_id = teacher_permissions.teacher_id
    )
  );

-- School admins can manage permissions for teachers in their school
CREATE POLICY "School admins manage teacher permissions" ON public.teacher_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles admin_p
      WHERE admin_p.id = auth.uid()
      AND admin_p.role = 'admin'
      AND admin_p.school_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.profiles teacher_p
        WHERE teacher_p.id = teacher_permissions.teacher_id
        AND teacher_p.school_id = admin_p.school_id
      )
    )
  );

-- Super admins can manage all permissions
CREATE POLICY "Super admin manage all permissions" ON public.teacher_permissions
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.is_super_admin = TRUE
    )
  );
