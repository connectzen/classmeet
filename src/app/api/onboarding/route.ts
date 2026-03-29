import { createClient } from '@/lib/supabase/server'
import { apiError, apiResponse, requireAuth } from '@/lib/api-utils'
import { resolveUserDestination } from '@/lib/routing/user-destination'
import type { UserRole } from '@/lib/supabase/types'
import type { RedirectProfile } from '@/lib/routing/user-destination'

const ALLOWED_ROLES: UserRole[] = ['teacher', 'student', 'admin']

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const selectedRole = body?.role as UserRole | undefined

    if (!selectedRole || !ALLOWED_ROLES.includes(selectedRole)) {
      return apiError('Invalid role selection', 400)
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

    const profilePayload = {
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

    const result = await supabase
      .from('profiles')
      .upsert(profilePayload, { onConflict: 'id' })
      .select('role, school_id, is_super_admin')
      .single()

    const profile = result.data as RedirectProfile | null
    const error = result.error

    if (error) {
      throw error
    }

    if (!profile) {
      throw new Error('Could not load saved profile')
    }

    const destination = resolveUserDestination(profile, null)

    return apiResponse({
      role: profile.role,
      schoolId: profile.school_id,
      isSuperAdmin: profile.is_super_admin,
      destination,
    })
  } catch (err) {
    return apiError(err, 500)
  }
}