-- Performance indexes: address missing indexes on frequently queried columns
-- These cover middleware auth checks, RLS policies, permission lookups,
-- dashboard queries, and target resolution.

-- 1. teacher_permissions: composite for permission checking (used in every API auth check)
CREATE INDEX IF NOT EXISTS idx_teacher_permissions_teacher_permission
  ON public.teacher_permissions(teacher_id, permission);

-- 2. profiles: role filtering (used in middleware, admin queries, RLS policies)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

-- 3. profiles: school_id + role composite (used in school-scoped queries and RLS)
CREATE INDEX IF NOT EXISTS idx_profiles_school_id_role
  ON public.profiles(school_id, role)
  WHERE school_id IS NOT NULL;

-- 4. schools: admin_id (used in RLS ownership checks)
CREATE INDEX IF NOT EXISTS idx_schools_admin_id
  ON public.schools(admin_id);

-- 5. teacher_workspaces: teacher_id (used in slug resolution in middleware and layouts)
CREATE INDEX IF NOT EXISTS idx_teacher_workspaces_teacher_id
  ON public.teacher_workspaces(teacher_id);

-- 6. teacher_students: composite for access control verification
CREATE INDEX IF NOT EXISTS idx_teacher_students_teacher_student
  ON public.teacher_students(teacher_id, student_id);

-- 7. session_targets: composite for student session loading (dashboard heavy query)
CREATE INDEX IF NOT EXISTS idx_session_targets_type_target
  ON public.session_targets(target_type, target_id);

-- 8. course_targets: composite for enrolled course resolution
CREATE INDEX IF NOT EXISTS idx_course_targets_type_target
  ON public.course_targets(target_type, target_id);

-- 9. group_members: student_id for group-based target resolution
CREATE INDEX IF NOT EXISTS idx_group_members_student_id
  ON public.group_members(student_id);

-- 10. sessions: teacher_id for dashboard count queries
CREATE INDEX IF NOT EXISTS idx_sessions_teacher_id
  ON public.sessions(teacher_id);

-- 11. sessions: status for live session filtering
CREATE INDEX IF NOT EXISTS idx_sessions_status
  ON public.sessions(status);

-- 12. conversations: for message queries
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id
  ON public.messages(conversation_id);

-- 13. conversation_participants: user_id for unread message counting
CREATE INDEX IF NOT EXISTS idx_conversation_participants_user_id
  ON public.conversation_participants(user_id);
