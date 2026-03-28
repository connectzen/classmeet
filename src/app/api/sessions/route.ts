import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth, requireSchoolContext } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get user's profile to check for school context
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const body = await request.json()
    const { title, description, status, max_participants, room_name, scheduled_at } = body

    if (!title || !room_name) {
      return apiError('title and room_name are required', 400)
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        teacher_id: user.id,
        title,
        description: description || null,
        status: status || 'scheduled',
        max_participants: max_participants || 50,
        room_name,
        scheduled_at: scheduled_at || null,
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

    // Get user's school to filter by
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    let query = supabase.from('sessions').select('*')

    // Filter by school_id if user has one
    if (profile?.school_id) {
      query = query.eq('school_id', profile.school_id)
    }

    if (searchParams.has('teacher_id')) {
      query = query.eq('teacher_id', searchParams.get('teacher_id')!)
    }

    if (searchParams.has('status')) {
      const status = searchParams.get('status')
      if (status === 'live' || status === 'scheduled' || status === 'ended') {
        query = query.eq('status', status)
      }
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
