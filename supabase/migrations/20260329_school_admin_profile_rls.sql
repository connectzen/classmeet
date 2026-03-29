-- Allow school admins to view all profiles in their school
CREATE POLICY "School admin can view school profiles"
ON profiles
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = profiles.school_id
      AND schools.admin_id = auth.uid()
  )
);
