import { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiResponse, apiError, ApiError } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      schoolName,
      schoolSlug,
      adminName,
      adminEmail,
      adminPassword,
      defaultTeacherPassword,
      defaultStudentPassword,
    } = body

    if (!schoolName || !schoolSlug || !adminName || !adminEmail || !adminPassword) {
      throw new ApiError('Missing required fields', 400)
    }

    // Validate slug format
    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(schoolSlug)) {
      throw new ApiError('Slug must be lowercase letters, numbers, and hyphens only', 400)
    }

    if (adminPassword.length < 8) {
      throw new ApiError('Password must be at least 8 characters', 400)
    }

    const supabase = createAdminClient()

    // Check slug uniqueness
    const { data: existingSchool } = await supabase
      .from('schools')
      .select('id')
      .eq('slug', schoolSlug)
      .single()

    if (existingSchool) {
      throw new ApiError('This school URL is already taken', 409)
    }

    // Create the admin auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
      user_metadata: { full_name: adminName },
    })

    if (authError || !authData.user) {
      throw new ApiError(authError?.message || 'Failed to create admin user', 400)
    }

    const adminId = authData.user.id

    // Create the school
    const { data: school, error: schoolError } = await supabase
      .from('schools')
      .insert({
        name: schoolName,
        slug: schoolSlug,
        admin_id: adminId,
        default_teacher_password: defaultTeacherPassword || 'Teacher@123',
        default_student_password: defaultStudentPassword || 'Student@123',
      })
      .select()
      .single()

    if (schoolError || !school) {
      // Rollback: delete the auth user we just created
      await supabase.auth.admin.deleteUser(adminId)
      throw new ApiError(schoolError?.message || 'Failed to create school', 500)
    }

    // Update the admin's profile
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: adminId,
        full_name: adminName,
        role: 'admin',
        school_id: school.id,
        onboarding_complete: true,
        goals: [],
        subjects: [],
      })

    if (profileError) {
      // Rollback
      await supabase.from('schools').delete().eq('id', school.id)
      await supabase.auth.admin.deleteUser(adminId)
      throw new ApiError('Failed to set up admin profile', 500)
    }

    return apiResponse({
      school: {
        id: school.id,
        name: school.name,
        slug: school.slug,
      },
      redirectUrl: `/${school.slug}/admin`,
    }, 201)
  } catch (error) {
    return apiError(error)
  }
}
