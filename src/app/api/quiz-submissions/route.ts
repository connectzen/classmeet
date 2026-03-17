import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { quiz_id, session_id, student_name, responses } = body

    if (!quiz_id || !session_id || !student_name) {
      return apiError('quiz_id, session_id, and student_name are required', 400)
    }

    if (!Array.isArray(responses) || responses.length === 0) {
      return apiError('responses array is required', 400)
    }

    // Fetch quiz questions for auto-grading
    const { data: questions, error: qErr } = await supabase
      .from('quiz_questions')
      .select('id, question_type, correct_index, correct_answer, sort_order')
      .eq('quiz_id', quiz_id)
      .order('sort_order', { ascending: true })

    if (qErr) throw qErr

    const questionMap = new Map(questions.map(q => [q.id, q]))
    const maxScore = questions.length

    // Auto-grade MCQ and true/false; leave short_answer/fill_blank as null
    let autoScore = 0
    const gradedResponses = responses.map((r: { question_id: string; answer_index?: number; answer_text?: string }) => {
      const q = questionMap.get(r.question_id)
      if (!q) return { question_id: r.question_id, answer_index: r.answer_index ?? null, answer_text: r.answer_text ?? null, is_correct: null as boolean | null, sort_order: 0, teacher_comment: null as string | null }

      let isCorrect: boolean | null = null
      if (q.question_type === 'multiple_choice' || q.question_type === 'true_false') {
        isCorrect = r.answer_index === q.correct_index
        if (isCorrect) autoScore++
      }
      // short_answer / fill_blank: leave is_correct as null for teacher grading

      return {
        question_id: r.question_id,
        answer_index: r.answer_index ?? null,
        answer_text: r.answer_text ?? null,
        is_correct: isCorrect,
        sort_order: q.sort_order,
        teacher_comment: null as string | null,
      }
    })

    // Check how many questions need manual grading
    const needsManualGrading = gradedResponses.some((r: { is_correct: boolean | null }) => r.is_correct === null)

    // Fetch pass threshold
    const { data: quiz } = await supabase
      .from('quizzes')
      .select('pass_threshold')
      .eq('id', quiz_id)
      .single()

    const passThreshold = quiz?.pass_threshold ?? 70
    const percentage = maxScore > 0 ? Math.round((autoScore / maxScore) * 100 * 100) / 100 : 0

    // Create submission
    const { data: submission, error: subErr } = await supabase
      .from('quiz_submissions')
      .insert({
        quiz_id,
        session_id,
        student_id: user.id,
        student_name,
        submitted_at: new Date().toISOString(),
        status: needsManualGrading ? 'submitted' : 'graded',
        score: autoScore,
        max_score: maxScore,
        percentage,
        passed: !needsManualGrading && percentage >= passThreshold,
        teacher_comment: null,
        graded_by: null,
      })
      .select()
      .single()

    if (subErr) throw subErr

    // Insert all responses
    const responsesWithSubmission = gradedResponses.map(r => ({
      ...r,
      submission_id: submission.id,
    }))

    const { error: respErr } = await supabase
      .from('quiz_responses')
      .insert(responsesWithSubmission)

    if (respErr) throw respErr

    return apiResponse(submission, 201)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = supabase.from('quiz_submissions').select('*')

    if (searchParams.has('quiz_id')) {
      query = query.eq('quiz_id', searchParams.get('quiz_id')!)
    }
    if (searchParams.has('session_id')) {
      query = query.eq('session_id', searchParams.get('session_id')!)
    }
    if (searchParams.has('student_id')) {
      query = query.eq('student_id', searchParams.get('student_id')!)
    }

    query = query.order('submitted_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
