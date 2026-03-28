import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin, auditSuperAdminAction } from '@/lib/api-utils'

export async function GET(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()
    const { schoolId } = await params

    const { data: school, error } = await supabase
      .from('schools')
      .select('*')
      .eq('id', schoolId)
      .single()

    if (error || !school) return apiError('School not found', 404)
    return apiResponse(school)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function PATCH(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    const userId = await requireSuperAdmin(request)
    const supabase = await createClient()
    const { schoolId } = await params
    const body = await request.json()

    const { data: school, error } = await supabase
      .from('schools')
      .update(body)
      .eq('id', schoolId)
      .select()
      .single()

    if (error || !school) return apiError('School not found', 404)

    // Audit
    await auditSuperAdminAction(supabase as any, userId, 'update_school', 'school', schoolId, body)

    return apiResponse(school)
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ schoolId: string }> }) {
  try {
    const userId = await requireSuperAdmin(request)
    const supabase = await createClient()
    const { schoolId } = await params

    // Get school first
    const { data: school } = await supabase
      .from('schools')
      .select('name, slug')
      .eq('id', schoolId)
      .single()

    if (!school) return apiError('School not found', 404)

    // Delete school (cascades via FK constraints)
    const { error } = await supabase
      .from('schools')
      .delete()
      .eq('id', schoolId)

    if (error) throw error

    // Audit
    await auditSuperAdminAction(supabase as any, userId, 'delete_school', 'school', schoolId, { name: school.name, slug: school.slug })

    return apiResponse({ success: true })
  } catch (err) {
    return apiError(err, 500)
  }
}
