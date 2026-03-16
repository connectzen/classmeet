import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('teacher_students')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Enrollment not found', 404)
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

    // Get enrollment and verify teacher ownership
    const { data: enrollment } = await supabase
      .from('teacher_students')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!enrollment) return apiError('Enrollment not found', 404)
    if (enrollment.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('teacher_students')
      .update({
        status: body.status,
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

    // Get enrollment and verify teacher ownership
    const { data: enrollment } = await supabase
      .from('teacher_students')
      .select('teacher_id')
      .eq('id', id)
      .single()

    if (!enrollment) return apiError('Enrollment not found', 404)
    if (enrollment.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('teacher_students').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Enrollment deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
