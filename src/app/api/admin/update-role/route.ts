import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'
import type { UserRole } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return apiError('Forbidden', 403)

    const { userId, role } = await request.json()
    if (!userId || !role) return apiError('userId and role are required', 400)
    if (!['admin', 'teacher', 'student', 'member', 'guest'].includes(role)) return apiError('Invalid role', 400)

    // Use service role client to bypass RLS
    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ role: role as UserRole, updated_at: new Date().toISOString() })
      .eq('id', userId)

    if (error) throw error
    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
