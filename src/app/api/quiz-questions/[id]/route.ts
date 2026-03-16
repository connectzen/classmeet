import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Question not found', 404)
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

    // Get question and verify quiz ownership
    const { data: question } = await supabase
      .from('quiz_questions')
      .select('quiz_id')
      .eq('id', id)
      .single()

    if (!question) return apiError('Question not found', 404)

    const { data: quiz } = await supabase.from('quizzes').select('teacher_id').eq('id', question.quiz_id).single()

    if (!quiz || quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('quiz_questions')
      .update({
        question_text: body.question_text,
        question_type: body.question_type,
        options: body.options,
        correct_index: body.correct_index,
        correct_answer: body.correct_answer,
        sort_order: body.sort_order,
        time_limit: body.time_limit,
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

    // Get question and verify quiz ownership
    const { data: question } = await supabase
      .from('quiz_questions')
      .select('quiz_id')
      .eq('id', id)
      .single()

    if (!question) return apiError('Question not found', 404)

    const { data: quiz } = await supabase.from('quizzes').select('teacher_id').eq('id', question.quiz_id).single()

    if (!quiz || quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('quiz_questions').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Question deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
