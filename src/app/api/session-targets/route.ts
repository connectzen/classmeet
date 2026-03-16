import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { session_id, target_type, target_id } = body

    if (!session_id || !target_type || !target_id) {
      return apiError('session_id, target_type, and target_id are required', 400)
    }

    // Verify session ownership
    const { data: session } = await supabase
      .from('sessions')
      .select('teacher_id')
      .eq('id', session_id)
      .single()

    if (!session || session.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('session_targets')
      .insert({
        session_id,
        target_type,
        target_id,
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

    let query = supabase.from('session_targets').select('*')

    if (searchParams.has('session_id')) {
      query = query.eq('session_id', searchParams.get('session_id')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
