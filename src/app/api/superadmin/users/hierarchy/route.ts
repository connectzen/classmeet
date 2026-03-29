import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()

    // Fetch all schools
    const { data: schools } = await supabase
      .from('schools')
      .select('id, name, slug, admin_id, created_at')
      .order('created_at', { ascending: false })

    // Fetch all profiles
    const { data: profilesRaw } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url, role, school_id, is_super_admin, onboarding_complete, created_at')
      .order('created_at', { ascending: false })

    // Fetch teacher-student relationships
    const { data: teacherStudents } = await supabase
      .from('teacher_students')
      .select('teacher_id, student_id')

    const allProfiles = (profilesRaw || []) as any[]
    const allSchools = schools || []
    const tsLinks = teacherStudents || []

    // Build teacher → students map
    const teacherStudentMap: Record<string, string[]> = {}
    for (const link of tsLinks) {
      if (!teacherStudentMap[link.teacher_id]) {
        teacherStudentMap[link.teacher_id] = []
      }
      teacherStudentMap[link.teacher_id].push(link.student_id)
    }

    // Build profile lookup
    const profileMap = new Map(allProfiles.map(p => [p.id, p]))

    // Organize hierarchy: schools → admin + teachers → students
    const schoolHierarchy = allSchools.map(school => {
      const admin = allProfiles.find(p => p.id === school.admin_id)
      const schoolMembers = allProfiles.filter(p => p.school_id === school.id && p.id !== school.admin_id)
      const teachers = schoolMembers.filter(p => p.role === 'teacher')
      const students = schoolMembers.filter(p => p.role === 'student')

      const teachersWithStudents = teachers.map(teacher => ({
        ...teacher,
        students: (teacherStudentMap[teacher.id] || [])
          .map(sid => profileMap.get(sid))
          .filter(Boolean),
      }))

      // Students not linked to any teacher in this school
      const linkedStudentIds = new Set(
        teachers.flatMap(t => teacherStudentMap[t.id] || [])
      )
      const unlinkedStudents = students.filter(s => !linkedStudentIds.has(s.id))

      return {
        ...school,
        admin,
        teachers: teachersWithStudents,
        unlinkedStudents,
        totalMembers: schoolMembers.length + (admin ? 1 : 0),
      }
    })

    // Users without a school
    const unaffiliated = allProfiles.filter(
      p => !p.school_id && !p.is_super_admin
    )

    // Super admins
    const superAdmins = allProfiles.filter(p => p.is_super_admin)

    return apiResponse({
      schools: schoolHierarchy,
      unaffiliated,
      superAdmins,
      totals: {
        schools: allSchools.length,
        users: allProfiles.length,
      },
    })
  } catch (err) {
    return apiError(err, 500)
  }
}
