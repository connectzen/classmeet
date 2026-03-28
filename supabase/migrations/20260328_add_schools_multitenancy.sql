-- ============================================================
-- ClassMeet Multi-Tenant School System Migration
-- Run this in the Supabase Dashboard SQL Editor
-- ============================================================

-- 1. Create the schools table
CREATE TABLE IF NOT EXISTS public.schools (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  primary_color text DEFAULT '#6366f1',
  secondary_color text DEFAULT '#818cf8',
  admin_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  default_teacher_password text DEFAULT 'Teacher@123',
  default_student_password text DEFAULT 'Student@123',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS schools_slug_idx ON public.schools(slug);

-- 2. Create the classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  teacher_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS classes_school_id_idx ON public.classes(school_id);

-- 3. Create class_members table
CREATE TABLE IF NOT EXISTS public.class_members (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at timestamptz DEFAULT now(),
  UNIQUE(class_id, student_id)
);

CREATE INDEX IF NOT EXISTS class_members_class_id_idx ON public.class_members(class_id);

-- 4. Add school_id to existing tables
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.courses ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.groups ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.sessions ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.quizzes ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.conversations ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;
ALTER TABLE public.teacher_students ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE CASCADE;

-- Indexes for school_id
CREATE INDEX IF NOT EXISTS profiles_school_id_idx ON public.profiles(school_id);
CREATE INDEX IF NOT EXISTS courses_school_id_idx ON public.courses(school_id);
CREATE INDEX IF NOT EXISTS groups_school_id_idx ON public.groups(school_id);
CREATE INDEX IF NOT EXISTS sessions_school_id_idx ON public.sessions(school_id);
CREATE INDEX IF NOT EXISTS quizzes_school_id_idx ON public.quizzes(school_id);
CREATE INDEX IF NOT EXISTS conversations_school_id_idx ON public.conversations(school_id);
CREATE INDEX IF NOT EXISTS teacher_students_school_id_idx ON public.teacher_students(school_id);

-- 5. Helper function: get user's school_id
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- 6. RLS on schools
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Anyone can read schools" ON public.schools;
CREATE POLICY "Anyone can read schools" ON public.schools
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admin can update own school" ON public.schools;
CREATE POLICY "Admin can update own school" ON public.schools
  FOR UPDATE USING (admin_id = auth.uid());

DROP POLICY IF EXISTS "Service role can insert schools" ON public.schools;
CREATE POLICY "Service role can insert schools" ON public.schools
  FOR INSERT WITH CHECK (true);

-- 7. RLS on classes
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can read classes" ON public.classes;
CREATE POLICY "School members can read classes" ON public.classes
  FOR SELECT USING (
    school_id = public.get_user_school_id()
  );

DROP POLICY IF EXISTS "School admin can manage classes" ON public.classes;
CREATE POLICY "School admin can manage classes" ON public.classes
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.schools
      WHERE schools.id = classes.school_id
      AND schools.admin_id = auth.uid()
    )
  );

-- 8. RLS on class_members
ALTER TABLE public.class_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "School members can read class members" ON public.class_members;
CREATE POLICY "School members can read class members" ON public.class_members
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.classes
      WHERE classes.id = class_members.class_id
      AND classes.school_id = public.get_user_school_id()
    )
  );

DROP POLICY IF EXISTS "School admin can manage class members" ON public.class_members;
CREATE POLICY "School admin can manage class members" ON public.class_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.classes
      JOIN public.schools ON schools.id = classes.school_id
      WHERE classes.id = class_members.class_id
      AND schools.admin_id = auth.uid()
    )
  );

-- Done!
