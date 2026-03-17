import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireAuth(request)
    const supabase = await createClient()
    const { searchParams } = new URL(request.url)

    const submissionId = searchParams.get('submission_id')
    if (!submissionId) {
      return apiError('submission_id query param is required', 400)
    }

    const { data, error } = await supabase
      .from('quiz_responses')
      .select('*')
      .eq('submission_id', submissionId)
      .order('sort_order', { ascending: true })

    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
