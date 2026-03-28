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

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role, onboarding_complete, school_id')
    .eq('id', user.id)
    .single()

  // Redirect new users to onboarding before they can access the app
  if (!profile?.onboarding_complete) {
    redirect('/onboarding')
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

