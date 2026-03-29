import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { resolveUserDestination } from '@/lib/routing/user-destination'

export default async function Home() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect('/sign-in')
  }

  const { data: profile } = (await supabase
    .from('profiles')
    .select('role, school_id, is_super_admin')
    .eq('id', user.id)
    .single()) as any

  let schoolSlug: string | null = null
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()
    schoolSlug = school?.slug ?? null
  }

  redirect(resolveUserDestination(profile, schoolSlug))
}
