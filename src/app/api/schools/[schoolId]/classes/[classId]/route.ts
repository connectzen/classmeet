import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, ApiError, requireAuth } from '@/lib/api-utils'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ schoolId: string; classId: string }> }
) {
  try {
    const { schoolId, classId } = await props.params
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

    // Verify the class belongs to this school
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single()

    if (!existing) {
      throw new ApiError('Class not found', 404)
    }

    const body = await request.json()
    const { name, description, teacherId } = body

    const updates: Record<string, unknown> = {}
    if (name !== undefined) updates.name = name
    if (description !== undefined) updates.description = description || null
    if (teacherId !== undefined) updates.teacher_id = teacherId || null

    if (Object.keys(updates).length === 0) {
      throw new ApiError('No fields to update', 400)
    }

    // If setting a teacher, verify they belong to this school
    if (teacherId) {
      const { data: teacher } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', teacherId)
        .eq('school_id', schoolId)
        .eq('role', 'teacher')
        .single()

      if (!teacher) {
        throw new ApiError('Teacher not found in this school', 404)
      }
    }

    const { data: updated, error } = await supabase
      .from('classes')
      .update(updates)
      .eq('id', classId)
      .select()
      .single()

    if (error) throw error

    return apiResponse(updated)
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ schoolId: string; classId: string }> }
) {
  try {
    const { schoolId, classId } = await props.params
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

    // Verify the class belongs to this school
    const { data: existing } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single()

    if (!existing) {
      throw new ApiError('Class not found', 404)
    }

    // Delete class members first
    await supabase.from('class_members').delete().eq('class_id', classId)

    // Delete the class
    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId)

    if (error) throw error

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err)
  }
}
