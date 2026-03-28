import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, ApiError, requireAuth } from '@/lib/api-utils'

export async function GET(
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

    // Verify class belongs to this school
    const { data: cls } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single()

    if (!cls) {
      throw new ApiError('Class not found', 404)
    }

    // Get class members with profile info
    const { data: members, error } = await supabase
      .from('class_members')
      .select('id, student_id, added_at')
      .eq('class_id', classId)

    if (error) throw error

    // Fetch student profiles
    const studentIds = (members || []).map((m) => m.student_id)
    let studentMap: Record<string, { full_name: string | null }> = {}
    if (studentIds.length > 0) {
      const { data: students } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', studentIds)

      studentMap = Object.fromEntries(
        (students || []).map((s) => [s.id, { full_name: s.full_name }])
      )
    }

    const enriched = (members || []).map((m) => ({
      ...m,
      student_name: studentMap[m.student_id]?.full_name || 'Unknown',
    }))

    return apiResponse(enriched)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(
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

    // Verify class belongs to this school
    const { data: cls } = await supabase
      .from('classes')
      .select('id')
      .eq('id', classId)
      .eq('school_id', schoolId)
      .single()

    if (!cls) {
      throw new ApiError('Class not found', 404)
    }

    const body = await request.json()
    const { studentId } = body

    if (!studentId) {
      throw new ApiError('studentId is required', 400)
    }

    // Verify student belongs to this school
    const { data: student } = await supabase
      .from('profiles')
      .select('id, full_name')
      .eq('id', studentId)
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .single()

    if (!student) {
      throw new ApiError('Student not found in this school', 404)
    }

    // Check not already a member
    const { data: existingMember } = await supabase
      .from('class_members')
      .select('id')
      .eq('class_id', classId)
      .eq('student_id', studentId)
      .single()

    if (existingMember) {
      throw new ApiError('Student is already in this class', 409)
    }

    const { data: member, error } = await supabase
      .from('class_members')
      .insert({ class_id: classId, student_id: studentId })
      .select()
      .single()

    if (error) throw error

    return apiResponse({
      ...member,
      student_name: student.full_name || 'Unknown',
    }, 201)
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

    const body = await request.json()
    const { studentId } = body

    if (!studentId) {
      throw new ApiError('studentId is required', 400)
    }

    const { error } = await supabase
      .from('class_members')
      .delete()
      .eq('class_id', classId)
      .eq('student_id', studentId)

    if (error) throw error

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err)
  }
}
