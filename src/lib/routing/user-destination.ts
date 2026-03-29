export type RedirectRole = 'super_admin' | 'admin' | 'teacher' | 'student' | string | null | undefined

export interface RedirectProfile {
  role?: RedirectRole
  school_id?: string | null
  is_super_admin?: boolean | null
  teacher_type?: string | null
  workspace_slug?: string | null
}

export function roleSegment(role: RedirectRole): 'admin' | 'teacher' | 'student' {
  if (role === 'admin') return 'admin'
  if (role === 'teacher') return 'teacher'
  return 'student'
}

export function resolveUserDestination(profile: RedirectProfile | null, schoolSlug?: string | null): string {
  if (!profile) return '/onboarding'

  if (profile.is_super_admin || profile.role === 'super_admin') {
    return '/superadmin'
  }

  // New users should only enter onboarding while role is unset.
  if (!profile.role) {
    return '/onboarding'
  }

  if (profile.role === 'admin' && !profile.school_id) {
    return '/register-school'
  }

  // Independent teachers with a workspace go to their workspace slug
  if (profile.role === 'teacher' && profile.teacher_type === 'independent') {
    if (profile.workspace_slug) {
      return `/${profile.workspace_slug}/teacher`
    }
    // No workspace yet — send to setup
    return '/setup-workspace'
  }

  // Collaborator teachers go to the inviting teacher's workspace
  if (profile.role === 'teacher' && profile.teacher_type === 'collaborator') {
    if (profile.workspace_slug) {
      return `/${profile.workspace_slug}/teacher`
    }
    // Fallback to generic dashboard if workspace not resolved
    return '/dashboard'
  }

  if (profile.school_id && schoolSlug) {
    return `/${schoolSlug}/${roleSegment(profile.role)}`
  }

  return '/dashboard'
}