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
    .select('full_name, avatar_url, role, onboarding_complete')
    .eq('id', user.id)
    .single()

  // Redirect new users to onboarding before they can access the app
  if (!profile?.onboarding_complete) {
    redirect('/onboarding')
  }

  const appUser = {
    id: user.id,
    email: user.email ?? '',
    fullName: profile?.full_name ?? (user.user_metadata?.full_name as string | null) ?? '',
    avatarUrl: profile?.avatar_url ?? null,
    role: profile?.role ?? 'student',
    onboardingComplete: profile?.onboarding_complete ?? false,
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

