import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, ApiError, requireAuth } from '@/lib/api-utils'

export async function PATCH(
  request: Request,
  props: { params: Promise<{ schoolId: string; studentId: string }> }
) {
  try {
    const { schoolId, studentId } = await props.params
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

    // Verify student belongs to this school
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role, school_id')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .single()

    if (!existing) {
      throw new ApiError('Student not found in this school', 404)
    }

    const body = await request.json()
    const { fullName, email } = body

    const admin = createAdminClient()

    // Update email in auth if provided
    if (email) {
      const { error: authError } = await admin.auth.admin.updateUserById(studentId, {
        email,
      })
      if (authError) {
        throw new ApiError(authError.message || 'Failed to update email', 400)
      }
    }

    // Update profile
    const updates: Record<string, unknown> = {}
    if (fullName !== undefined) updates.full_name = fullName
    if (Object.keys(updates).length === 0 && !email) {
      throw new ApiError('No fields to update', 400)
    }

    // Also update user_metadata if fullName changed
    if (fullName) {
      await admin.auth.admin.updateUserById(studentId, {
        user_metadata: { full_name: fullName },
      })
    }

    let profile = existing
    if (Object.keys(updates).length > 0) {
      const { data, error } = await admin
        .from('profiles')
        .update(updates)
        .eq('id', studentId)
        .select()
        .single()

      if (error) throw error
      if (!data) throw new ApiError('Failed to update student profile', 500)
      profile = data
    } else {
      // Re-fetch to return current state
      const { data } = await admin
        .from('profiles')
        .select('*')
        .eq('id', studentId)
        .single()
      if (data) profile = data
    }

    return apiResponse(profile)
  } catch (err) {
    return apiError(err)
  }
}

export async function DELETE(
  request: Request,
  props: { params: Promise<{ schoolId: string; studentId: string }> }
) {
  try {
    const { schoolId, studentId } = await props.params
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

    // Verify student belongs to this school
    const { data: existing } = await supabase
      .from('profiles')
      .select('id, role, school_id')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .single()

    if (!existing) {
      throw new ApiError('Student not found in this school', 404)
    }

    // Delete auth user via admin client — profile will cascade
    const admin = createAdminClient()
    const { error } = await admin.auth.admin.deleteUser(studentId)
    if (error) {
      throw new ApiError(error.message || 'Failed to delete student', 500)
    }

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err)
  }
}
