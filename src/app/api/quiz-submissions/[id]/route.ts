import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Fetch the submission to verify teacher ownership
    const { data: submission } = await supabase
      .from('quiz_submissions')
      .select('quiz_id')
      .eq('id', id)
      .single()

    if (!submission) return apiError('Submission not found', 404)

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('teacher_id')
      .eq('id', submission.quiz_id)
      .single()

    if (!quiz) return apiError('Quiz not found', 404)
    if (quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    // Delete responses first (foreign key), then submission
    await supabase.from('quiz_responses').delete().eq('submission_id', id)
    const { error } = await supabase.from('quiz_submissions').delete().eq('id', id)

    if (error) throw error
    return apiResponse({ deleted: true })
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('quiz_submissions')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Submission not found', 404)
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

    // Fetch the submission + quiz to verify teacher ownership
    const { data: submission } = await supabase
      .from('quiz_submissions')
      .select('quiz_id')
      .eq('id', id)
      .single()

    if (!submission) return apiError('Submission not found', 404)

    const { data: quiz } = await supabase
      .from('quizzes')
      .select('teacher_id, pass_threshold')
      .eq('id', submission.quiz_id)
      .single()

    if (!quiz) return apiError('Quiz not found', 404)
    if (quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    // Build update payload — teacher grading
    const update: Record<string, unknown> = {}

    if (body.score !== undefined) update.score = body.score
    if (body.max_score !== undefined) update.max_score = body.max_score
    if (body.teacher_comment !== undefined) update.teacher_comment = body.teacher_comment  
    if (body.status !== undefined) update.status = body.status

    // Recalculate percentage and pass/fail if score info provided
    if (body.score !== undefined && body.max_score !== undefined) {
      const pct = body.max_score > 0
        ? Math.round((body.score / body.max_score) * 100 * 100) / 100
        : 0
      update.percentage = pct
      // Allow explicit pass/fail override from teacher; otherwise auto-calculate
      update.passed = body.passed !== undefined ? body.passed : pct >= (quiz.pass_threshold ?? 70)
    } else if (body.passed !== undefined) {
      update.passed = body.passed
    }

    if (body.status === 'graded') {
      update.graded_by = user.id
      update.graded_at = new Date().toISOString()
    }

    const { data, error } = await supabase
      .from('quiz_submissions')
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
