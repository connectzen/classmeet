-- Merge invite_students and invite_teachers into a single invite_members permission

-- Drop old CHECK constraint
ALTER TABLE teacher_permissions DROP CONSTRAINT IF EXISTS teacher_permissions_permission_check;

-- Insert invite_members for teachers who had either old permission
INSERT INTO teacher_permissions (teacher_id, permission, granted_by)
SELECT DISTINCT tp.teacher_id, 'invite_members', tp.granted_by
FROM teacher_permissions tp
WHERE tp.permission IN ('invite_students', 'invite_teachers')
  AND NOT EXISTS (
    SELECT 1 FROM teacher_permissions tp2
    WHERE tp2.teacher_id = tp.teacher_id AND tp2.permission = 'invite_members'
  );

-- Remove old permission rows
DELETE FROM teacher_permissions WHERE permission IN ('invite_students', 'invite_teachers');

-- Add updated CHECK constraint
ALTER TABLE teacher_permissions ADD CONSTRAINT teacher_permissions_permission_check
  CHECK (permission IN ('invite_members', 'create_groups', 'create_courses', 'create_sessions', 'manage_quizzes', 'manage_settings'));
