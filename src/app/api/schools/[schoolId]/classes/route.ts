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
      .select('id, admin_id')
      .eq('id', schoolId)
      .single()

    if (!school || school.admin_id !== user.id) {
      throw new ApiError('Forbidden', 403)
    }

    // List all classes in this school
    const { data: classes, error } = await supabase
      .from('classes')
      .select('*')
      .eq('school_id', schoolId)
      .order('created_at', { ascending: false })

    if (error) throw error

    // Fetch teacher names separately
    const teacherIds = [...new Set(
      (classes || [])
        .map((c) => c.teacher_id)
        .filter(Boolean) as string[]
    )]

    let teacherMap: Record<string, string> = {}
    if (teacherIds.length > 0) {
      const { data: teachers } = await supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', teacherIds)

      teacherMap = Object.fromEntries(
        (teachers || []).map((t) => [t.id, t.full_name || 'Unknown'])
      )
    }

    // Fetch member counts in a single query
    const classIds = (classes || []).map((c) => c.id)
    let memberCountMap: Record<string, number> = {}
    if (classIds.length > 0) {
      const { data: members } = await supabase
        .from('class_members')
        .select('class_id')
        .in('class_id', classIds)

      const counts: Record<string, number> = {}
      for (const m of members || []) {
        counts[m.class_id] = (counts[m.class_id] || 0) + 1
      }
      memberCountMap = counts
    }

    const enriched = (classes || []).map((c) => ({
      ...c,
      teacher_name: c.teacher_id ? (teacherMap[c.teacher_id] || null) : null,
      student_count: memberCountMap[c.id] || 0,
    }))

    return apiResponse(enriched)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(
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
    const { name, description } = body

    if (!name) {
      throw new ApiError('Class name is required', 400)
    }

    const { data: newClass, error } = await supabase
      .from('classes')
      .insert({
        name,
        description: description || null,
        school_id: schoolId,
      })
      .select()
      .single()

    if (error) throw error

    return apiResponse({ ...newClass, teacher_name: null, student_count: 0 }, 201)
  } catch (err) {
    return apiError(err)
  }
}
