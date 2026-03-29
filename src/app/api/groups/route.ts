import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth, requirePermission } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const { userId } = await requirePermission(request, 'create_groups')
    const body = await request.json()
    const supabase = await createClient()

    const { name, description } = body

    if (!name) {
      return apiError('name is required', 400)
    }

    const { data, error } = await supabase
      .from('groups')
      .insert({
        teacher_id: userId,
        name,
        description: description || null,
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

    let query = supabase.from('groups').select('*')

    if (searchParams.has('teacher_id')) {
      query = query.eq('teacher_id', searchParams.get('teacher_id')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
