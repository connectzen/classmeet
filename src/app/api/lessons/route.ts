import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { topic_id, title, type, content, video_url, sort_order } = body

    if (!topic_id || !title || !type) {
      return apiError('topic_id, title, and type are required', 400)
    }

    // Verify topic ownership via course
    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', topic_id)
      .single()

    if (!topic) return apiError('Topic not found', 404)

    const { data: course } = await supabase
      .from('courses')
      .select('teacher_id')
      .eq('id', topic.course_id)
      .single()

    if (!course || course.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('lessons')
      .insert({
        topic_id,
        title,
        type,
        content: content || '',
        video_url: video_url || null,
        sort_order: sort_order || 0,
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

    let query = supabase.from('lessons').select('*')

    if (searchParams.has('topic_id')) {
      query = query.eq('topic_id', searchParams.get('topic_id')!)
    }

    query = query.order('sort_order', { ascending: true })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
