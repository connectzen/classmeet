import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { conversation_id, user_id, user_name, user_role } = body

    if (!conversation_id || !user_id) {
      return apiError('conversation_id and user_id are required', 400)
    }

    // Verify conversation exists
    const { data: conversation } = await supabase
      .from('conversations')
      .select('id')
      .eq('id', conversation_id)
      .single()

    if (!conversation) {
      return apiError('Conversation not found', 404)
    }

    const { data, error } = await supabase
      .from('conversation_participants')
      .insert({
        conversation_id,
        user_id,
        user_name: user_name || '',
        user_role: user_role || 'member',
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

    let query = supabase.from('conversation_participants').select('*')

    if (searchParams.has('conversation_id')) {
      query = query.eq('conversation_id', searchParams.get('conversation_id')!)
    }

    if (searchParams.has('user_id')) {
      query = query.eq('user_id', searchParams.get('user_id')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
