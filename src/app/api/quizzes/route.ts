import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { title, description } = body

    if (!title) {
      return apiError('title is required', 400)
    }

    const { data, error } = await supabase
      .from('quizzes')
      .insert({
        teacher_id: user.id,
        title,
        description: description || null,
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

    let query = supabase.from('quizzes').select('*')

    if (searchParams.has('teacher_id')) {
      query = query.eq('teacher_id', searchParams.get('teacher_id')!)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
