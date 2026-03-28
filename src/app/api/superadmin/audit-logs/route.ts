import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = (supabase as any).from('super_admin_audit_log').select(`
      *,
      super_admin:super_admin_id(full_name, email)
    `)

    if (searchParams.has('action')) {
      query = query.eq('action', searchParams.get('action')!)
    }

    if (searchParams.has('days')) {
      const days = parseInt(searchParams.get('days')!)
      const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()
      query = query.gte('created_at', since)
    }

    const { data: logs, error } = await query.order('created_at', { ascending: false }).limit(500)

    if (error) throw error
    return apiResponse(logs || [])
  } catch (err) {
    return apiError(err, 500)
  }
}
