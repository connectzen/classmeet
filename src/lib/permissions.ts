import type { TeacherPermissionKey, TeacherType, UserRole } from '@/lib/supabase/types'

/** All available teacher permissions */
export const ALL_PERMISSIONS: TeacherPermissionKey[] = [
  'invite_students',
  'invite_teachers',
  'create_groups',
  'create_courses',
  'create_sessions',
  'manage_quizzes',
  'manage_settings',
]

/** Check if a user is an independent teacher */
export function isIndependent(role: UserRole | null | undefined, teacherType: TeacherType | null | undefined): boolean {
  return role === 'teacher' && teacherType === 'independent'
}

/** Check if a user is the "owner tier" — can manage others */
export function isOwnerTier(role: UserRole | null | undefined, teacherType: TeacherType | null | undefined): boolean {
  return role === 'admin' || (role === 'teacher' && teacherType === 'independent')
}

/** Check if a collaborator or school teacher has a specific permission */
export function hasPermission(
  permissions: TeacherPermissionKey[],
  key: TeacherPermissionKey,
): boolean {
  return permissions.includes(key)
}

/** Independent teachers and school admins always have full permissions */
export function resolveEffectivePermissions(
  role: UserRole | null | undefined,
  teacherType: TeacherType | null | undefined,
  grantedPermissions: TeacherPermissionKey[],
): TeacherPermissionKey[] {
  if (isOwnerTier(role, teacherType)) return [...ALL_PERMISSIONS]
  return grantedPermissions
}

export function canInviteStudents(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('invite_students')
}

export function canInviteTeachers(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('invite_teachers')
}

export function canCreateGroups(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('create_groups')
}

export function canCreateCourses(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('create_courses')
}

export function canCreateSessions(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('create_sessions')
}

export function canManageQuizzes(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('manage_quizzes')
}

export function canManageSettings(perms: TeacherPermissionKey[]): boolean {
  return perms.includes('manage_settings')
}

export function canManageBranding(role: UserRole | null | undefined, teacherType: TeacherType | null | undefined): boolean {
  return isIndependent(role, teacherType)
}
