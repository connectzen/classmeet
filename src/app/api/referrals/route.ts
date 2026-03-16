import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { referred_id } = body

    if (!referred_id) {
      return apiError('referred_id is required', 400)
    }

    const { data, error } = await supabase
      .from('referrals')
      .insert({
        referrer_id: user.id,
        referred_id,
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

    let query = supabase.from('referrals').select('*')

    if (searchParams.has('referrer_id')) {
      query = query.eq('referrer_id', searchParams.get('referrer_id')!)
    }

    if (searchParams.has('referred_id')) {
      query = query.eq('referred_id', searchParams.get('referred_id')!)
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
