import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, requireSuperAdmin, auditSuperAdminAction } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    await requireSuperAdmin(request)
    const supabase = await createClient()

    const { data: schools, error } = await supabase
      .from('schools')
      .select('*')
      .order('created_at', { ascending: false })

    if (error) throw error
    return apiResponse(schools || [])
  } catch (err) {
    return apiError(err, 500)
  }
}

export async function POST(request: Request) {
  try {
    const userId = await requireSuperAdmin(request)
    const supabase = await createClient()
    const body = await request.json()

    const { name, slug, primary_color, secondary_color } = body

    if (!name || !slug) {
      return apiError('name and slug are required', 400)
    }

    // Check slug uniqueness
    const { data: existing } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', slug)
      .single()

    if (existing) {
      return apiError('School slug already exists', 409)
    }

    const { data: school, error } = await supabase
      .from('schools')
      .insert({
        name,
        slug,
        primary_color: primary_color || '#3b82f6',
        secondary_color: secondary_color || '#10b981',
        admin_id: userId,
        created_by: userId,
        logo_url: null,
        default_teacher_password: 'teacher123',
        default_student_password: 'student123',
      })
      .select()
      .single()

    if (error) throw error

    // Audit
    await auditSuperAdminAction(supabase as any, userId, 'create_school', 'school', school.id, { name, slug })

    return apiResponse(school, 201)
  } catch (err) {
    return apiError(err, 500)
  }
}
