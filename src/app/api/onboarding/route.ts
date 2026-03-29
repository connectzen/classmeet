import { createClient } from '@/lib/supabase/server'
import { apiError, apiResponse, requireAuth } from '@/lib/api-utils'
import { resolveUserDestination } from '@/lib/routing/user-destination'
import type { UserRole, TeacherType } from '@/lib/supabase/types'
import type { RedirectProfile } from '@/lib/routing/user-destination'
import { ALL_PERMISSIONS } from '@/lib/permissions'

const ALLOWED_ROLES: UserRole[] = ['teacher', 'student', 'admin']
const ALLOWED_TEACHER_TYPES: TeacherType[] = ['independent', 'school_employed']

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const selectedRole = body?.role as UserRole | undefined
    const teacherType = body?.teacherType as TeacherType | undefined

    if (!selectedRole || !ALLOWED_ROLES.includes(selectedRole)) {
      return apiError('Invalid role selection', 400)
    }

    // Validate teacherType for teachers
    if (selectedRole === 'teacher') {
      if (!teacherType || !ALLOWED_TEACHER_TYPES.includes(teacherType)) {
        return apiError('Teacher type is required', 400)
      }
    }

    const supabase = await createClient()

    let finalRole: UserRole = selectedRole
    let isSuperAdmin = false

    try {
      const { data: settings } = await (supabase as any)
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'super_admin_email')
        .single()

      const superAdminEmail = settings?.setting_value?.email
      if (superAdminEmail && user.email?.toLowerCase() === superAdminEmail.toLowerCase()) {
        finalRole = 'super_admin'
        isSuperAdmin = true
      }
    } catch {
      // Fall back to the selected role if settings lookup fails.
    }

    const profilePayload: any = {
      id: user.id,
      full_name: (user.user_metadata?.full_name as string | undefined) ?? user.email?.split('@')[0] ?? '',
      avatar_url: (user.user_metadata?.avatar_url as string | undefined) ?? null,
      role: finalRole,
      is_super_admin: isSuperAdmin,
      goals: [],
      subjects: [],
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }

    // Set teacher_type for teacher role
    if (selectedRole === 'teacher' && teacherType) {
      profilePayload.teacher_type = teacherType
    }

    const result = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('role, school_id, is_super_admin, teacher_type')
      .single()

    const profile = result.data as (RedirectProfile & { teacher_type?: string }) | null
    const error = result.error

    if (error) {
      throw error
    }

    if (!profile) {
      throw new Error('Could not load saved profile')
    }

    // Auto-grant all permissions to independent teachers
    if (selectedRole === 'teacher' && teacherType === 'independent') {
      const permissionRows = ALL_PERMISSIONS.map(permission => ({
        teacher_id: user.id,
        granted_by: user.id,
        permission,
      }))
      await supabase.from('teacher_permissions').upsert(permissionRows, { onConflict: 'teacher_id,permission' })
    }

    // Independent teachers go to workspace setup instead of dashboard
    let destination: string
    if (selectedRole === 'teacher' && teacherType === 'independent') {
      destination = '/setup-workspace'
    } else {
      destination = resolveUserDestination(profile, null)
    }

    return apiResponse({
      role: profile.role,
      schoolId: profile.school_id,
      isSuperAdmin: profile.is_super_admin,
      teacherType: profile.teacher_type ?? null,
      destination,
    })
  } catch (err) {
    return apiError(err, 500)
  }
}