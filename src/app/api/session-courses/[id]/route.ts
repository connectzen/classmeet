import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get session course and verify session ownership
    const { data: sessionCourse } = await supabase
      .from('session_courses')
      .select('session_id')
      .eq('id', id)
      .single()

    if (!sessionCourse) return apiError('Session course not found', 404)

    const { data: session } = await supabase
      .from('sessions')
      .select('teacher_id')
      .eq('id', sessionCourse.session_id)
      .single()

    if (!session || session.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('session_courses').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Course removed from session' })
  } catch (err) {
    return apiError(err, 500)
  }
}
