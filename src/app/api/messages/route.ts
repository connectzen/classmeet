import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { conversation_id, content } = body

    if (!conversation_id || !content) {
      return apiError('conversation_id and content are required', 400)
    }

    const { data, error } = await supabase
      .from('messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        content,
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

    let query = supabase.from('messages').select('*')

    if (searchParams.has('conversation_id')) {
      query = query.eq('conversation_id', searchParams.get('conversation_id')!)
    }

    query = query.order('created_at', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
