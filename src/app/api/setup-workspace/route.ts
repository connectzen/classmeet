import { createClient } from '@/lib/supabase/server'
import { apiError, apiResponse, requireAuth } from '@/lib/api-utils'

export async function POST(request: Request) {
  try {
    const user = await requireAuth(request)
    const body = await request.json()

    const { name, slug, primaryColor, secondaryColor } = body

    if (!name?.trim() || !slug?.trim()) {
      return apiError('Name and slug are required', 400)
    }

    // Validate slug format
    if (!/^[a-z0-9][a-z0-9-]*[a-z0-9]$/.test(slug) && slug.length > 1) {
      return apiError('Slug must contain only lowercase letters, numbers, and hyphens', 400)
    }

    if (slug.length < 2 || slug.length > 48) {
      return apiError('Slug must be between 2 and 48 characters', 400)
    }

    const supabase = await createClient()

    // Verify user is an independent teacher
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, teacher_type')
      .eq('id', user.id)
      .single()

    if (profile?.role !== 'teacher' || profile?.teacher_type !== 'independent') {
      return apiError('Only independent teachers can create workspaces', 403)
    }

    // Check if workspace already exists for this teacher
    const { data: existing } = await supabase
      .from('teacher_workspaces')
      .select('id, slug')
      .eq('teacher_id', user.id)
      .maybeSingle()

    if (existing) {
      return apiResponse({ slug: existing.slug, alreadyExists: true })
    }

    // Check slug uniqueness across schools and workspaces
    const [{ data: schoolMatch }, { data: wsMatch }] = await Promise.all([
      supabase.from('schools').select('id').eq('slug', slug).maybeSingle(),
      supabase.from('teacher_workspaces').select('id').eq('slug', slug).maybeSingle(),
    ])

    if (schoolMatch || wsMatch) {
      return apiError('This URL slug is already taken', 409)
    }

    // Create workspace
    const { data: workspace, error } = await supabase
      .from('teacher_workspaces')
      .insert({
        teacher_id: user.id,
        name: name.trim(),
        slug: slug.trim(),
        primary_color: primaryColor || '#6366f1',
        secondary_color: secondaryColor || '#818cf8',
      })
      .select('id, slug')
      .single()

    if (error) {
      if (error.code === '23505') {
        return apiError('This URL slug is already taken', 409)
      }
      throw error
    }

    return apiResponse({ slug: workspace.slug })
  } catch (err) {
    return apiError(err, 500)
  }
}
