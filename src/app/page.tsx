import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Look up the user's profile
    const { data: profile } = (await supabase
      .from('profiles')
      .select('role, school_id, is_super_admin')
      .eq('id', user.id)
      .single()) as any

    // Super admin goes to super admin dashboard
    if (profile?.is_super_admin || profile?.role === 'super_admin') {
      redirect('/superadmin')
    }

    // If user has a school, redirect to their school dashboard
    if (profile?.school_id) {
      const { data: school } = await supabase
        .from('schools')
        .select('slug')
        .eq('id', profile.school_id)
        .single()

      if (school) {
        const roleRoute = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
        redirect(`/${school.slug}/${roleRoute}`)
      }
    }

    // If user is logged in but no school assigned yet, go to onboarding
    redirect('/onboarding')
  } else {
    // Not logged in: redirect to sign-in
    redirect('/sign-in')
  }
}
