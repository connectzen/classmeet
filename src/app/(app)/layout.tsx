import type { ReactNode } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import AppStoreHydrator from '@/components/layout/AppStoreHydrator'
import { SchoolHydrator } from '@/components/layout/SchoolHydrator'
import { roleSegment } from '@/lib/routing/user-destination'
import { resolveEffectivePermissions } from '@/lib/permissions'
import type { TeacherType, TeacherPermissionKey } from '@/lib/supabase/types'

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

  // Onboarding is only for users that have no role yet.
  if (!profile?.role) {
    redirect('/onboarding')
  }

  // Super admin → redirect to /superadmin
  if (profile?.is_super_admin || profile?.role === 'super_admin') {
    redirect('/superadmin')
  }

  // School admins without a school should complete school setup.
  if (profile?.role === 'admin' && !profile?.school_id) {
    redirect('/register-school')
  }

  // If user belongs to a school, redirect to school-scoped route
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()

    if (school) {
      redirect(`/${school.slug}/${roleSegment(profile.role)}`)
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

  // Load workspace slug for independent teachers
  let workspaceSlug: string | null = null
  if (profile?.role === 'teacher' && profile?.teacher_type === 'independent') {
    const { data: workspace } = await supabase
      .from('teacher_workspaces')
      .select('slug')
      .eq('teacher_id', user.id)
      .single()
    workspaceSlug = workspace?.slug ?? null
  }

  // Load granted permissions for teachers
  let grantedPermissions: TeacherPermissionKey[] = []
  if (profile?.role === 'teacher') {
    const { data: perms } = await (supabase as any)
      .from('teacher_permissions')
      .select('permission')
      .eq('teacher_id', user.id)
    grantedPermissions = (perms ?? []).map((p: any) => p.permission)
  }
  const permissions = resolveEffectivePermissions(profile?.role, profile?.teacher_type, grantedPermissions)

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
    teacherType: (profile?.teacher_type as TeacherType | null) ?? null,
    workspaceSlug,
    permissions,
  }

  const schoolContext = {
    schoolId: profile?.school_id ?? '',
    schoolSlug: schoolSlug ?? '',
    schoolName: 'ClassMeet',
    schoolLogo: null,
    primaryColor: '#6366f1',
    secondaryColor: '#818cf8',
  }

  return (
    <AppStoreHydrator user={appUser}>
      <SchoolHydrator value={schoolContext}>
        <div className="app-layout">
          <Sidebar />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <TopBar />
            <main className="main-content">
              {children}
            </main>
          </div>
        </div>
      </SchoolHydrator>
    </AppStoreHydrator>
  )
}
