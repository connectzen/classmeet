import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get participant
    const { data: participant } = await supabase
      .from('conversation_participants')
      .select('user_id, conversation_id')
      .eq('id', id)
      .single()

    if (!participant) return apiError('Participant not found', 404)

    // Allow if it's the user themselves or the conversation creator
    const { data: conversation } = await supabase
      .from('conversations')
      .select('created_by')
      .eq('id', participant.conversation_id)
      .single()

    if (participant.user_id !== user.id && conversation?.created_by !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('conversation_participants').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Participant removed' })
  } catch (err) {
    return apiError(err, 500)
  }
}
