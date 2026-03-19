import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

/**
 * DELETE /api/profile/account
 *
 * Permanently deletes the calling user's account via the admin client.
 * The auth.users cascade will clean up related data (profiles, etc.)
 * according to the database foreign-key constraints.
 */
export async function DELETE() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(user.id)
    if (error) return apiError(error.message, 500)

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
