-- Allow school admins to manage teacher_students records for their school
-- This enables the admin teachers page to assign/unassign school students to teachers

CREATE POLICY "School admin can view school enrollments"
ON teacher_students FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = teacher_students.school_id
    AND schools.admin_id = auth.uid()
  )
);

CREATE POLICY "School admin can assign students to teachers"
ON teacher_students FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = teacher_students.school_id
    AND schools.admin_id = auth.uid()
  )
);

CREATE POLICY "School admin can unassign students from teachers"
ON teacher_students FOR DELETE
USING (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = teacher_students.school_id
    AND schools.admin_id = auth.uid()
  )
);

CREATE POLICY "School admin can update school enrollments"
ON teacher_students FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM schools
    WHERE schools.id = teacher_students.school_id
    AND schools.admin_id = auth.uid()
  )
);
