import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'
import type { UserRole } from '@/lib/supabase/types'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    const { full_name, avatar_url, goals, subjects } = body

    const { data, error } = await supabase
      .from('profiles')
      .insert({
        id: user.id,
        full_name: full_name || user.email?.split('@')[0],
        avatar_url: avatar_url || null,
        goals: goals || [],
        subjects: subjects || [],
        role: 'student',
        onboarding_complete: false,
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

    let query = supabase.from('profiles').select('*')

    if (searchParams.has('role')) {
      const role = searchParams.get('role')
      if (role && ['admin', 'teacher', 'student'].includes(role)) {
        query = query.eq('role', role as UserRole)
      }
    }

    if (searchParams.has('onboarding_complete')) {
      query = query.eq('onboarding_complete', searchParams.get('onboarding_complete') === 'true')
    }

    const { data, error } = await query
    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
