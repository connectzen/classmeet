import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth, requireOwnership } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('courses')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Course not found', 404)
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

    // Check ownership
    await requireOwnership('courses', id, user.id, 'teacher_id')

    const { data, error } = await supabase
      .from('courses')
      .update({
        title: body.title,
        description: body.description,
        subject: body.subject,
        level: body.level,
        published: body.published,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return apiError('Course not found', 404)
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

    // Check ownership
    await requireOwnership('courses', id, user.id, 'teacher_id')

    const { error } = await supabase.from('courses').delete().eq('id', id)

    if (error) throw error
    return apiResponse({ message: 'Course deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
