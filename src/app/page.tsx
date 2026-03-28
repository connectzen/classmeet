import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    // Look up the user's school to redirect to the correct school URL
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

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

    // Fallback: user has no school
    redirect('/register-school')
  } else {
    redirect('/register-school')
  }
}
