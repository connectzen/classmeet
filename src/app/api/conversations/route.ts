import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { type, name } = body

    if (!type) {
      return apiError('type is required', 400)
    }

    const { data, error } = await supabase
      .from('conversations')
      .insert({
        type,
        name: name || null,
        created_by: user.id,
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

    let query = supabase.from('conversations').select('*')

    if (searchParams.has('type')) {
      const type = searchParams.get('type')
      if (type === 'direct' || type === 'group') {
        query = query.eq('type', type)
      }
    }

    if (searchParams.has('created_by')) {
      query = query.eq('created_by', searchParams.get('created_by')!)
    }

    query = query.order('created_at', { ascending: false })

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
