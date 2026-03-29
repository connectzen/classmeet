import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth, requirePermission } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const { userId } = await requirePermission(request, 'create_sessions')
    const body = await request.json()
    const supabase = await createClient()

    const { title, description, status, max_participants, room_name, scheduled_at } = body

    if (!title || !room_name) {
      return apiError('title and room_name are required', 400)
    }

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        teacher_id: userId,
        title,
        description: description || null,
        status: status || 'scheduled',
        max_participants: max_participants || 50,
        room_name,
        scheduled_at: scheduled_at || null,
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
    await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = supabase.from('sessions').select('*')

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
