import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    await requireAuth(request)
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .single()

    if (error) throw error
    if (!data) return apiError('Profile not found', 404)
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function PATCH(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const body = await request.json()
    const supabase = await createClient()

    // Users can only update their own profile
    if (user.id !== id && user.role !== 'admin') {
      return apiError('Forbidden', 403)
    }

    const { data, error } = await supabase
      .from('profiles')
      .update({
        full_name: body.full_name,
        avatar_url: body.avatar_url,
        goals: body.goals,
        subjects: body.subjects,
        onboarding_complete: body.onboarding_complete,
        last_seen: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    if (!data) return apiError('Profile not found', 404)
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Only admins can delete profiles, or users themselves
    if (user.id !== id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('profiles').delete().eq('id', id)

    if (error) throw error
    return apiResponse({ message: 'Profile deleted' })
  } catch (err) {
    return apiError(err, 500)
  }
}
