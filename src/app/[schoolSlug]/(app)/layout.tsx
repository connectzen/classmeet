import type { ReactNode } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import AppStoreHydrator from '@/components/layout/AppStoreHydrator'
import { SchoolHydrator } from '@/components/layout/SchoolHydrator'
import { SchoolThemeProvider } from '@/lib/school-theme'

interface Props {
  children: ReactNode
  params: Promise<{ schoolSlug: string }>
}

export default async function SchoolAppLayout({ children, params }: Props) {
  const { schoolSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/${schoolSlug}/sign-in`)

  // Load school
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, slug, logo_url, primary_color, secondary_color')
    .eq('slug', schoolSlug)
    .single()

  if (!school) notFound()

  // Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, avatar_url, role, onboarding_complete, school_id')
    .eq('id', user.id)
    .single()

  // Verify user belongs to this school
  if (!profile || profile.school_id !== school.id) {
    redirect('/onboarding')
  }

  const appUser = {
    id: user.id,
    email: user.email ?? '',
    fullName: profile.full_name ?? (user.user_metadata?.full_name as string | null) ?? '',
    avatarUrl: profile.avatar_url ?? null,
    role: profile.role ?? 'student',
    onboardingComplete: profile.onboarding_complete ?? false,
    schoolId: school.id,
    schoolSlug: school.slug,
    isSuperAdmin: false,
  }

  const schoolContext = {
    schoolId: school.id,
    schoolSlug: school.slug,
    isSuperAdmin: false,
    schoolName: school.name,
    schoolLogo: school.logo_url,
    primaryColor: school.primary_color,
    secondaryColor: school.secondary_color,
  }

  return (
    <AppStoreHydrator user={appUser}>
      <SchoolHydrator value={schoolContext}>
        <SchoolThemeProvider>
          <div className="app-layout">
            <Sidebar />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <TopBar />
              <main className="main-content">
                {children}
              </main>
            </div>
          </div>
        </SchoolThemeProvider>
      </SchoolHydrator>
    </AppStoreHydrator>
  )
}
