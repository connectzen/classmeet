import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import AppStoreHydrator from '@/components/layout/AppStoreHydrator'

export default async function AppLayout({ children }: { children: ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect('/sign-in')

  // Load profile with all needed fields including is_super_admin
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  const profile = profileData as any

  // Redirect new users to onboarding before they can access the app
  if (!profile?.onboarding_complete) {
    redirect('/onboarding')
  }

  // Super admin → redirect to /superadmin
  if (profile?.is_super_admin) {
    redirect('/superadmin')
  }

  // If user belongs to a school, redirect to school-scoped route
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()

    if (school) {
      const roleSegment = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
      redirect(`/${school.slug}/${roleSegment}/dashboard`)
    }
  }

  // Load school slug if user belongs to a school
  let schoolSlug: string | null = null
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()
    schoolSlug = school?.slug ?? null
  }

  const appUser = {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | null) ?? '',
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role ?? 'student',
    onboardingComplete: profile?.onboarding_complete ?? false,
    schoolId: profile?.school_id ?? null,
    schoolSlug,
    isSuperAdmin: profile?.is_super_admin ?? false,
  }

  return (
    <AppStoreHydrator user={appUser}>
      <div className="app-layout">
        <Sidebar />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <TopBar />
          <main className="main-content">
            {children}
          </main>
        </div>
      </div>
    </AppStoreHydrator>
  )
}
