import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get target and verify course ownership
    const { data: target } = await supabase
      .from('course_targets')
      .select('course_id')
      .eq('id', id)
      .single()

    if (!target) return apiError('Target not found', 404)

    const { data: course } = await supabase
      .from('courses')
      .select('teacher_id')
      .eq('id', target.course_id)
      .single()

    if (!course || course.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('course_targets').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Target removed' })
  } catch (err) {
    return apiError(err, 500)
  }
}
