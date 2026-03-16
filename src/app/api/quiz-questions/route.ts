import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { quiz_id, question_text, question_type, options, correct_index, correct_answer, sort_order, time_limit } =
      body

    if (!quiz_id || !question_text || !question_type) {
      return apiError('quiz_id, question_text, and question_type are required', 400)
    }

    // Verify quiz ownership
    const { data: quiz } = await supabase.from('quizzes').select('teacher_id').eq('id', quiz_id).single()

    if (!quiz || quiz.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('quiz_questions')
      .insert({
        quiz_id,
        question_text,
        question_type,
        options: options || [],
        correct_index: correct_index || null,
        correct_answer: correct_answer || null,
        sort_order: sort_order || 0,
        time_limit: time_limit || 0,
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

    let query = supabase.from('quiz_questions').select('*')

    if (searchParams.has('quiz_id')) {
      query = query.eq('quiz_id', searchParams.get('quiz_id')!)
    }

    query = query.order('sort_order', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
