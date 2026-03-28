import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError } from '@/lib/api-utils'

export async function DELETE(request: Request) {
  try {
    // Verify caller is admin
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return apiError('Unauthorized', 401)

    const { data: caller } = await supabase.from('profiles').select('role').eq('id', user.id).single()
    if (caller?.role !== 'admin') return apiError('Forbidden', 403)

    const { studentId, teacherId } = await request.json()
    if (!studentId || !teacherId) return apiError('studentId and teacherId are required', 400)

    // Use service role client to bypass RLS
    const admin = createAdminClient()

    // Delete the teacher_students record
    const { error } = await admin
      .from('teacher_students')
      .delete()
      .eq('student_id', studentId)
      .eq('teacher_id', teacherId)

    if (error) throw error
    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
