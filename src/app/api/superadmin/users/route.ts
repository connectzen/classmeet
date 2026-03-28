import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = supabase.from('profiles').select('*, schools:school_id(id, name, slug)', { count: 'exact' })

    if (searchParams.has('role')) {
      query = query.eq('role', searchParams.get('role')! as any)
    }

    if (searchParams.has('search')) {
      const search = searchParams.get('search')!
      query = query.or(`full_name.ilike.%${search}%,id.eq.${search}`)
    }

    const { data: users, error } = await query.order('created_at', { ascending: false }).limit(100)

    if (error) throw error
    return apiResponse(users || [])
  } catch (err) {
    return apiError(err, 500)
  }
}
