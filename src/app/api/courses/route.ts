import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { title, description, subject, level } = body

    if (!title || !subject) {
      return apiError('title and subject are required', 400)
    }

    // Get user's school context
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    const { data, error } = await supabase
      .from('courses')
      .insert({
        teacher_id: user.id,
        title,
        description: description || '',
        subject,
        level: level || 'beginner',
        published: false,
        school_id: profile?.school_id || null,
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
    const user = await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    // Get user's school context
    const { data: profile } = await supabase
      .from('profiles')
      .select('school_id')
      .eq('id', user.id)
      .single()

    let query = supabase.from('courses').select('*')

    // Filter by school_id if user has one
    if (profile?.school_id) {
      query = query.eq('school_id', profile.school_id)
    }

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
