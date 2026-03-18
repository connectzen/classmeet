import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('quizzes')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Quiz not found', 404)
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

    // Get quiz and verify ownership
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!quiz) return apiError('Quiz not found', 404)
    if (quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const update: Record<string, unknown> = {}
    if (body.title !== undefined) update.title = body.title
    if (body.description !== undefined) update.description = body.description
    if (body.pass_threshold !== undefined) update.pass_threshold = body.pass_threshold
    if (body.reveal_delay_days !== undefined) update.reveal_delay_days = body.reveal_delay_days
    if (body.exam_start_date !== undefined) update.exam_start_date = body.exam_start_date

    const { data, error } = await supabase
      .from('quizzes')
      .update(update)
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

    // Get quiz and verify ownership
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!quiz) return apiError('Quiz not found', 404)
    if (quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('quizzes').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Quiz deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
