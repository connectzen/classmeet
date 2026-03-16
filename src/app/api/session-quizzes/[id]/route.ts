import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get session quiz and verify session ownership
    const { data: sessionQuiz } = await supabase
      .from('session_quizzes')
      .select('session_id')
      .eq('id', id)
      .single()

    if (!sessionQuiz) return apiError('Session quiz not found', 404)

    const { data: session } = await supabase
      .from('sessions')
      .select('teacher_id')
      .eq('id', sessionQuiz.session_id)
      .single()

    if (!session || session.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('session_quizzes').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Quiz removed from session' })
  } catch (err) {
    return apiError(err, 500)
  }
}
