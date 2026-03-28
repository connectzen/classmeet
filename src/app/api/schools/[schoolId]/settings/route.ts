import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, ApiError, requireAuth } from '@/lib/api-utils'

export async function GET(
  request: Request,
  props: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Verify caller is admin of this school
    const { data: school } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single()

    if (!school || school.admin_id !== user.id) {
      throw new ApiError('Forbidden', 403)
    }

    return apiResponse({
      name: school.name,
      slug: school.slug,
      defaultTeacherPassword: school.default_teacher_password,
      defaultStudentPassword: school.default_student_password,
    })
  } catch (err) {
    return apiError(err)
  }
}

export async function PATCH(
  request: Request,
  props: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Verify caller is admin of this school
    const { data: school } = await supabase
      .from('schools')
      .select('id, admin_id')
      .eq('id', schoolId)
      .single()

    if (!school || school.admin_id !== user.id) {
      throw new ApiError('Forbidden', 403)
    }

    const body = await request.json()
    const { name, defaultTeacherPassword, defaultStudentPassword } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (defaultTeacherPassword !== undefined) updates.default_teacher_password = defaultTeacherPassword
    if (defaultStudentPassword !== undefined) updates.default_student_password = defaultStudentPassword

    if (Object.keys(updates).length === 0) {
      throw new ApiError('No fields to update', 400)
    }

    const { data: updated, error } = await supabase
      .from('schools')
      .update(updates)
      .eq('id', schoolId)
      .select()
      .single()

    if (error) throw error

    return apiResponse({
      name: updated.name,
      slug: updated.slug,
      defaultTeacherPassword: updated.default_teacher_password,
      defaultStudentPassword: updated.default_student_password,
    })
  } catch (err) {
    return apiError(err)
  }
}
