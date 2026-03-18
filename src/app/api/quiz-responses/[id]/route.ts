import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAuth(request)
    const { id } = await params
    const body = await request.json()
    const supabase = await createClient()

    const update: Record<string, unknown> = {}
    if (body.is_correct !== undefined) update.is_correct = body.is_correct
    if (body.score !== undefined) update.score = body.score
    if (body.teacher_comment !== undefined) update.teacher_comment = body.teacher_comment

    if (Object.keys(update).length === 0) {
      return apiError('No fields to update', 400)
    }

    const { data, error } = await supabase
      .from('quiz_responses')
      .update(update)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error
    return apiResponse(data)
  } catch (err) {
    return apiError(err, 500)
  }
}
