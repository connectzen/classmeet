import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

/**
 * POST /api/invite/join
 * Body: { teacherId: string, role: 'teacher' | 'student' }
 *
 * Handles the two writes that fail under RLS when done client-side:
 *   1. profiles.update — RLS INSERT policy blocks upsert even for own row
 *   2. teacher_students.insert — RLS may require a valid profile role first
 *
 * Using the admin client here bypasses RLS while still verifying auth.
 */
export async function POST(request: Request) {
  try {
    // Verify the caller is authenticated
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const body = await request.json()
    const { teacherId, role } = body

    if (!teacherId || !role) return apiError('teacherId and role are required', 400)
    if (!['teacher', 'student'].includes(role)) return apiError('Invalid role', 400)

    const admin = createAdminClient()

    // Build profile update payload
    const profileUpdate: Record<string, any> = {
      role,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    }

    // Set teacher_type and invited_by for teachers joining as collaborators
    if (role === 'teacher') {
      profileUpdate.teacher_type = 'collaborator'
      profileUpdate.invited_by = teacherId
    }

    // Step 1 — set the chosen role on the profile (admin bypasses RLS)
    const { error: profileError } = await admin
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id)

    if (profileError) return apiError(profileError.message, 500)

    // Step 2 — create the teacher<>student connection (admin bypasses RLS)
    const { error: joinError } = await admin
      .from('teacher_students')
      .upsert(
        { teacher_id: teacherId, student_id: user.id },
        { onConflict: 'teacher_id,student_id' }
      )

    if (joinError) return apiError(joinError.message, 500)

    // Step 3 — referral tracking for students only
    if (role === 'student') {
      await admin.from('profiles')
        .update({ referred_by: teacherId })
        .eq('id', user.id)
      await admin.from('referrals')
        .upsert({ referrer_id: teacherId, referred_id: user.id }, { onConflict: 'referred_id' })
    }

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
