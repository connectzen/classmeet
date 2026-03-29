import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

export async function GET() {
  try {
    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: caller } = await supabase.from('profiles').select('role, school_id').eq('id', user.id).single()
    if (caller?.role !== 'admin') return apiError('Forbidden', 403)
    if (!caller.school_id) return apiError('Admin not assigned to a school', 400)

    const schoolId = caller.school_id

    // Use service role client to bypass RLS
    const admin = createAdminClient()

    // Fetch all data filtered by school
    const [teachersRes, studentsRes, enrollmentsRes, courseCountRes] = await Promise.all([
      admin
        .from('profiles')
        .select('id, full_name, avatar_url, role, subjects')
        .eq('role', 'teacher')
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true }),
      admin
        .from('profiles')
        .select('id, full_name, avatar_url, role, created_at')
        .in('role', ['student', 'member', 'guest'])
        .eq('school_id', schoolId)
        .order('full_name', { ascending: true }),
      admin
        .from('teacher_students')
        .select('teacher_id, student_id, status, enrolled_at'),
      admin
        .from('courses')
        .select('*', { count: 'exact', head: true }),
    ])

    const teachers = teachersRes.data || []
    const students = studentsRes.data || []
    const enrollments = enrollmentsRes.data || []

    // Compute unassigned students
    const assignedIds = new Set(enrollments.map(e => e.student_id))
    const unassignedStudents = students.filter(s => !assignedIds.has(s.id))

    return apiResponse({
      teachers,
      students,
      enrollments,
      unassignedStudents,
      stats: {
        totalTeachers: teachers.length,
        totalStudents: students.length,
        unassignedCount: unassignedStudents.length,
        totalCourses: courseCountRes.count || 0,
      },
    })
  } catch (err) {
    return apiError(err, 500)
  }
}
