import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { student_id } = body

    if (!student_id) {
      return apiError('student_id is required', 400)
    }

    const { data, error } = await supabase
      .from('teacher_students')
      .insert({
        teacher_id: user.id,
        student_id,
        status: 'pending',
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

    let query = supabase.from('teacher_students').select('*')

    if (searchParams.has('teacher_id')) {
      query = query.eq('teacher_id', searchParams.get('teacher_id')!)
    }

    if (searchParams.has('student_id')) {
      query = query.eq('student_id', searchParams.get('student_id')!)
    }

    if (searchParams.has('status')) {
      const status = searchParams.get('status')
      if (status === 'active' || status === 'inactive' || status === 'pending') {
        query = query.eq('status', status)
      }
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
