import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    // Verify caller is a teacher or admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, full_name')
      .eq('id', user.id)
      .single()

    const canSendInvites = profile?.role === 'teacher' || profile?.role === 'admin'

    if (!canSendInvites) {
      return apiError('Only teachers can send invites', 403)
    }

    const body = await request.json()
    const { email, teacherId } = body
    if (!email || !teacherId) return apiError('email and teacherId are required', 400)

    const origin = request.headers.get('origin') || 'https://classmeet.live'
    // Route through auth callback → set-password (invited users have no password) → invite page.
    // Double-encode next so the inner ?next= survives Supabase appending &token_hash=...&type=invite.
    const setPasswordNext = encodeURIComponent(`/invite/${teacherId}`)
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/set-password?next=${setPasswordNext}`)}`

    const admin = createAdminClient()

    // Invite user — creates account if new, sends magic link if existing
    const { error } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { invited_by: teacherId, invited_by_name: profile.full_name || 'A teacher', needs_password_setup: true },
    })

    if (error) {
      // User already has an account — they should use the share link instead
      if (error.message.toLowerCase().includes('already registered') ||
          error.message.toLowerCase().includes('already been registered') ||
          error.message.toLowerCase().includes('user already exists')) {
        return apiError('This email already has a ClassMeet account. Share the invite link with them directly.', 409)
      }
      throw error
    }

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
