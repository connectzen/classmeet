import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { group_id, student_id } = body

    if (!group_id || !student_id) {
      return apiError('group_id and student_id are required', 400)
    }

    // Verify group ownership
    const { data: group } = await supabase
      .from('groups')
      .select('teacher_id')
      .eq('id', group_id)
      .single()

    if (!group || group.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('group_members')
      .insert({
        group_id,
        student_id,
      })
      .select()
      .single()

    if (error) throw error
    return apiResponse(data, 201)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function GET(request: Request) {
  try {
    await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    let query = supabase.from('group_members').select('*')

    if (searchParams.has('group_id')) {
      query = query.eq('group_id', searchParams.get('group_id')!)
    }

    if (searchParams.has('student_id')) {
      query = query.eq('student_id', searchParams.get('student_id')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
