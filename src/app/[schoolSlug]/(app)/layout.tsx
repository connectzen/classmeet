import type { ReactNode } from 'react'
import { redirect, notFound } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import Sidebar from '@/components/layout/Sidebar'
import TopBar from '@/components/layout/TopBar'
import AppStoreHydrator from '@/components/layout/AppStoreHydrator'
import { SchoolHydrator } from '@/components/layout/SchoolHydrator'
import { SchoolThemeProvider } from '@/lib/school-theme'
import { resolveEffectivePermissions } from '@/lib/permissions'
import type { TeacherType, TeacherPermissionKey } from '@/lib/supabase/types'

interface Props {
  children: ReactNode
  params: Promise<{ schoolSlug: string }>
}

export default async function SchoolAppLayout({ children, params }: Props) {
  const { schoolSlug } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) redirect(`/${schoolSlug}/sign-in`)

  // Try resolving as a school first
  const { data: school } = await supabase
    .from('schools')
    .select('id, name, slug, logo_url, primary_color, secondary_color')
    .eq('slug', schoolSlug)
    .single()

  if (school) {
    // School slug resolved — load school layout
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, avatar_url, role, onboarding_complete, school_id')
      .eq('id', user.id)
      .single()

    if (!profile || profile.school_id !== school.id) {
      redirect('/dashboard')
    }

    // Load permissions for school teachers
    let grantedPerms: TeacherPermissionKey[] = []
    if (profile.role === 'teacher') {
      const { data: perms } = await (supabase as any)
        .from('teacher_permissions')
        .select('permission')
        .eq('teacher_id', user.id)
      grantedPerms = (perms ?? []).map((p: any) => p.permission)
    }
    const permissions = resolveEffectivePermissions(profile.role, (profile as any).teacher_type, grantedPerms)

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
      teacherType: ((profile as any).teacher_type as TeacherType | null) ?? null,
      workspaceSlug: null,
      permissions,
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

  // Try resolving as a teacher workspace slug
  const { data: workspace } = await (supabase as any)
    .from('teacher_workspaces')
    .select('id, teacher_id, name, slug, logo_url, primary_color, secondary_color')
    .eq('slug', schoolSlug)
    .maybeSingle()

  if (!workspace) notFound()

  // Load profile
  const { data: profile } = await (supabase as any)
    .from('profiles')
    .select('full_name, avatar_url, role, onboarding_complete, school_id, teacher_type, invited_by')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // Verify user has access to this workspace (owner, collaborator, or student)
  const isOwner = workspace.teacher_id === user.id
  const isCollaborator = profile.teacher_type === 'collaborator' && profile.invited_by === workspace.teacher_id
  let isStudent = false
  if (profile.role === 'student') {
    const { data: link } = await (supabase as any)
      .from('teacher_students')
      .select('id')
      .eq('teacher_id', workspace.teacher_id)
      .eq('student_id', user.id)
      .maybeSingle()
    isStudent = !!link
  }

  if (!isOwner && !isCollaborator && !isStudent) {
    redirect('/dashboard')
  }

  // Load permissions for workspace teachers
  let wsGrantedPerms: TeacherPermissionKey[] = []
  if (profile.role === 'teacher') {
    const { data: perms } = await (supabase as any)
      .from('teacher_permissions')
      .select('permission')
      .eq('teacher_id', user.id)
    wsGrantedPerms = (perms ?? []).map((p: any) => p.permission)
  }
  const wsPermissions = resolveEffectivePermissions(profile.role, profile.teacher_type, wsGrantedPerms)

  const appUser = {
    id: user.id,
    email: user.email ?? '',
    fullName: profile.full_name ?? (user.user_metadata?.full_name as string | null) ?? '',
    avatarUrl: profile.avatar_url ?? null,
    role: profile.role ?? 'student',
    onboardingComplete: profile.onboarding_complete ?? false,
    schoolId: null as string | null,
    schoolSlug: workspace.slug,
    isSuperAdmin: false,
    teacherType: (profile.teacher_type as TeacherType | null) ?? null,
    workspaceSlug: workspace.slug,
    permissions: wsPermissions,
  }

  const workspaceContext = {
    schoolId: workspace.id,
    schoolSlug: workspace.slug,
    schoolName: workspace.name,
    schoolLogo: workspace.logo_url,
    primaryColor: workspace.primary_color ?? '#6366f1',
    secondaryColor: workspace.secondary_color ?? '#818cf8',
    isTeacherWorkspace: true,
    workspaceOwnerId: workspace.teacher_id,
  }

  return (
    <AppStoreHydrator user={appUser}>
      <SchoolHydrator value={workspaceContext}>
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
