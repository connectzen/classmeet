import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

export async function DELETE(request: Request) {
  try {
    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return apiError('Forbidden', 403)

    const { userId } = await request.json()
    if (!userId) return apiError('userId is required', 400)
    if (userId === user.id) return apiError('Cannot delete your own account', 400)

    // Use service role client — deletes auth user + cascades to profile
    const admin = createAdminClient()

    // Delete profile first (in case no cascade)
    await admin.from('profiles').delete().eq('id', userId)

    // Delete auth user (permanent)
    const { error } = await admin.auth.admin.deleteUser(userId)
    if (error) throw error

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
