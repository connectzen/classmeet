import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('conversations')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Conversation not found', 404)
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

    // Get conversation and verify ownership
    const { data: conversation } = await supabase
      .from('conversations')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!conversation) return apiError('Conversation not found', 404)
    if (conversation.created_by !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('conversations')
      .update({
        name: body.name,
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

    // Get conversation and verify ownership
    const { data: conversation } = await supabase
      .from('conversations')
      .select('created_by')
      .eq('id', id)
      .single()

    if (!conversation) return apiError('Conversation not found', 404)
    if (conversation.created_by !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('conversations').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Conversation deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
