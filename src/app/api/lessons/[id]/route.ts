import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('lessons')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Lesson not found', 404)
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

    // Get lesson and verify ownership
    const { data: lesson } = await supabase
      .from('lessons')
      .select('topic_id')
      .eq('id', id)
      .single()

    if (!lesson) return apiError('Lesson not found', 404)

    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', lesson.topic_id)
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
      .update({
        title: body.title,
        type: body.type,
        content: body.content,
        video_url: body.video_url,
        sort_order: body.sort_order,
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

    // Get lesson and verify ownership
    const { data: lesson } = await supabase
      .from('lessons')
      .select('topic_id')
      .eq('id', id)
      .single()

    if (!lesson) return apiError('Lesson not found', 404)

    const { data: topic } = await supabase
      .from('topics')
      .select('course_id')
      .eq('id', lesson.topic_id)
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

    const { error } = await supabase.from('lessons').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Lesson deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
