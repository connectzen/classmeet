import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()

    // Get counts
    const [
      { count: schoolCount },
      { count: profileCount },
      { data: auditLogs }
    ] = await Promise.all([
      supabase.from('schools').select('id', { count: 'exact', head: true }),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      (supabase as any).from('super_admin_audit_log').select('*').order('created_at', { ascending: false }).limit(10),
    ])

    return apiResponse({
      stats: {
        totalSchools: schoolCount || 0,
        totalUsers: profileCount || 0,
        totalProfiles: profileCount || 0,
        recentAuditCount: auditLogs?.length || 0,
      },
      recentAudits: auditLogs || [],
    })
  } catch (err) {
    return apiError(err, 500)
  }
}
