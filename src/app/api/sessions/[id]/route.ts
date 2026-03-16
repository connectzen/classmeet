import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Session not found', 404)
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    // Get session and verify ownership
    const { data: session } = await supabase
      .from('sessions')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!session) return apiError('Session not found', 404)
    if (session.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('sessions')
      .update({
        title: body.title,
        description: body.description,
        status: body.status,
        max_participants: body.max_participants,
        room_name: body.room_name,
        scheduled_at: body.scheduled_at,
        started_at: body.started_at,
        ended_at: body.ended_at,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get session and verify ownership
    const { data: session } = await supabase
      .from('sessions')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!session) return apiError('Session not found', 404)
    if (session.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('sessions').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Session deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
