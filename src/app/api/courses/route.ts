import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth, requirePermission } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const { userId } = await requirePermission(request, 'create_courses')
    const body = await request.json()
    const supabase = await createClient()

    const { title, description, subject, level } = body

    if (!title || !subject) {
      return apiError('title and subject are required', 400)
    }

    const { data, error } = await supabase
      .from('courses')
      .insert({
        teacher_id: userId,
        title,
        description: description || '',
        subject,
        level: level || 'beginner',
        published: false,
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

    let query = supabase.from('courses').select('*')

    if (searchParams.has('teacher_id')) {
      query = query.eq('teacher_id', searchParams.get('teacher_id')!)
    }

    if (searchParams.has('published')) {
      query = query.eq('published', searchParams.get('published') === 'true')
    }

    if (searchParams.has('subject')) {
      query = query.eq('subject', searchParams.get('subject')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
