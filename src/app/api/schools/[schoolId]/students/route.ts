import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'
import { apiResponse, apiError, ApiError, requireAuth } from '@/lib/api-utils'

export async function GET(
  request: Request,
  props: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Verify caller is admin of this school
    const { data: school } = await supabase
      .from('schools')
      .select('id, admin_id')
      .eq('id', schoolId)
      .single()

    if (!school || school.admin_id !== user.id) {
      throw new ApiError('Forbidden', 403)
    }

    // List all students in this school
    const { data: students, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('school_id', schoolId)
      .eq('role', 'student')
      .order('created_at', { ascending: false })

    if (error) throw error

    return apiResponse(students)
  } catch (err) {
    return apiError(err)
  }
}

export async function POST(
  request: Request,
  props: { params: Promise<{ schoolId: string }> }
) {
  try {
    const { schoolId } = await props.params
    const user = await requireAuth(request)
    const supabase = await createClient()

    // Verify caller is admin of this school
    const { data: school } = await supabase
      .from('schools')
      .select('id, admin_id, default_student_password, name, slug, logo_url')
      .eq('id', schoolId)
      .single()

    if (!school || school.admin_id !== user.id) {
      throw new ApiError('Forbidden', 403)
    }

    const body = await request.json()
    const { fullName, email, password } = body

    if (!fullName || !email) {
      throw new ApiError('fullName and email are required', 400)
    }

    const finalPassword = password || school.default_student_password
    const origin = request.headers.get('origin') || 'https://classmeet.live'

    // Create auth user via service role
    const admin = createAdminClient()

    // Invite user by email — sends a welcome email with a magic link
    const setPasswordNext = encodeURIComponent(`/${school.slug}/student`)
    const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(`/set-password?next=${setPasswordNext}`)}`

    const { data: inviteData, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: fullName,
        school_name: school.name,
        school_logo: school.logo_url || '',
        role: 'student',
      },
    })

    if (inviteError || !inviteData.user) {
      // If user already exists, fall back to createUser
      if (inviteError?.message?.toLowerCase().includes('already') ||
          inviteError?.message?.toLowerCase().includes('exists')) {
        const { data: authData, error: authError } = await admin.auth.admin.createUser({
          email,
          password: finalPassword,
          email_confirm: true,
          user_metadata: { full_name: fullName },
        })

        if (authError || !authData.user) {
          throw new ApiError(authError?.message || 'Failed to create student user', 400)
        }

        // Upsert profile for existing user
        const { data: profile, error: profileError } = await admin
          .from('profiles')
          .upsert({
            id: authData.user.id,
            full_name: fullName,
            role: 'student',
            school_id: schoolId,
            onboarding_complete: true,
            goals: [],
            subjects: [],
          })
          .select()
          .single()

        if (profileError) {
          await admin.auth.admin.deleteUser(authData.user.id)
          throw new ApiError(profileError.message || 'Failed to create student profile', 500)
        }

        return apiResponse(profile, 201)
      }

      throw new ApiError(inviteError?.message || 'Failed to invite student', 400)
    }

    // Upsert profile with student role
    const { data: profile, error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: inviteData.user.id,
        full_name: fullName,
        role: 'student',
        school_id: schoolId,
        onboarding_complete: true,
        goals: [],
        subjects: [],
      })
      .select()
      .single()

    if (profileError) {
      await admin.auth.admin.deleteUser(inviteData.user.id)
      throw new ApiError(profileError.message || 'Failed to create student profile', 500)
    }

    return apiResponse(profile, 201)
  } catch (err) {
    return apiError(err)
  }
}
