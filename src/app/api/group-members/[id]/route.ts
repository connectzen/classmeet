import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireAuth } from '@/lib/api-utils'

export async function DELETE(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Get member and verify group ownership
    const { data: member } = await supabase
      .from('group_members')
      .select('group_id')
      .eq('id', id)
      .single()

    if (!member) return apiError('Member not found', 404)

    const { data: group } = await supabase
      .from('groups')
      .select('teacher_id')
      .eq('id', member.group_id)
      .single()

    if (!group || group.teacher_id !== user.id) {
      return apiError('Forbidden', 403)
    }

    const { error } = await supabase.from('group_members').delete().eq('id', id)
    if (error) throw error
    return apiResponse({ message: 'Member removed' })
  } catch (err) {
    return apiError(err, 500)
  }
}
