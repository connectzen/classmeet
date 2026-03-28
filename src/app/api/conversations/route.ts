import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { type, name } = body

    if (!type) {
      return apiError('type is required', 400)
    }

    // Get user's school context
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        type,
        name: name || null,
        created_by: user.id,
        school_id: profile?.school_id || null,
      })
      .select()
      .single()

    if (error) throw error
    return apiResponse(data, 201)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get user's school context
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    let query = supabase.from('conversations').select('*')

    // Filter by school_id if user has one
    if (profile?.school_id) {
      query = query.eq('school_id', profile.school_id)
    }

    if (searchParams.has('type')) {
      const type = searchParams.get('type')
      if (type === 'direct' || type === 'group') {
        query = query.eq('type', type)
      }
    }

    if (searchParams.has('created_by')) {
      query = query.eq('created_by', searchParams.get('created_by')!)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
