import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

// Routes that are known static (never a school slug)
const STATIC_FIRST_SEGMENTS = new Set([
  'register-school',
  'sign-in',
  'sign-up',
  'forgot-password',
  'verify-email',
  'set-password',
  'onboarding',
  'invite',
  'admin',
  'auth',
  'api',
  'dashboard',
  'room',
  'superadmin',
])

/** Redirect helper — look up user's school and build /{slug}/{role} path */
async function getUserSchoolRedirect(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  userEmail: string,
  requestUrl: NextRequest['nextUrl'],
) {
  const result = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const profile = result.data as any

  // Check if email matches super admin email
  let isSuperAdmin = profile?.is_super_admin || false
  if (!isSuperAdmin) {
    try {
      const { data: settings } = await (supabase as any)
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'super_admin_email')
        .single()
      const superAdminEmail = settings?.setting_value?.email
      if (superAdminEmail && userEmail.toLowerCase() === superAdminEmail.toLowerCase()) {
        isSuperAdmin = true
        // Persist the flag so future checks are faster
        await supabase.from('profiles').update({
          is_super_admin: true,
          role: 'super_admin',
          onboarding_complete: true,
          updated_at: new Date().toISOString(),
        }).eq('id', userId)
      }
    } catch {
      // Ignore if system_settings lookup fails
    }
  }

  // Super admin → redirect to /superadmin
  if (isSuperAdmin) {
    const url = requestUrl.clone()
    url.pathname = '/superadmin'
    return NextResponse.redirect(url)
  }

  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()

    if (school) {
      const roleRoute = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
      const url = requestUrl.clone()
      url.pathname = `/${school.slug}/${roleRoute}`
      return NextResponse.redirect(url)
    }
  }

  // No school — existing users go to old dashboard, new users go to onboarding
  const url = requestUrl.clone()
  url.pathname = profile?.onboarding_complete ? '/dashboard' : '/onboarding'
  return NextResponse.redirect(url)
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const pathname = request.nextUrl.pathname
  const firstSegment = pathname.split('/')[1] || ''

  // ── API routes: always pass through ──
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // ── Password setup guard (invited users) ──
  if (
    user &&
    user.user_metadata?.needs_password_setup === true &&
    !pathname.startsWith('/set-password')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/set-password'
    url.search = ''
    const invitedBy = user.user_metadata?.invited_by as string | undefined
    if (invitedBy) url.searchParams.set('next', `/invite/${invitedBy}`)
    return NextResponse.redirect(url)
  }

  // ── Onboarding: only redirect away users who are already onboarded or super admin ──
  if (pathname === '/onboarding') {
    if (user) {
      const result = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      const profile = result.data as any

      // Super admin → check by flag first, then by email
      let isSuperAdmin = profile?.is_super_admin || false
      if (!isSuperAdmin) {
        try {
          const { data: settings } = await (supabase as any)
            .from('system_settings')
            .select('setting_value')
            .eq('setting_key', 'super_admin_email')
            .single()
          const superAdminEmail = settings?.setting_value?.email
          if (superAdminEmail && user.email?.toLowerCase() === superAdminEmail.toLowerCase()) {
            isSuperAdmin = true
          }
        } catch { /* ignore */ }
      }

      if (isSuperAdmin) {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin'
        return NextResponse.redirect(url)
      }

      // Already onboarded → send to their dashboard
      if (profile?.onboarding_complete) {
        if (profile?.school_id) {
          const { data: school } = await supabase
            .from('schools')
            .select('slug')
            .eq('id', profile.school_id)
            .single()
          if (school) {
            const roleRoute = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
            const url = request.nextUrl.clone()
            url.pathname = `/${school.slug}/${roleRoute}`
            return NextResponse.redirect(url)
          }
        }
        const url = request.nextUrl.clone()
        url.pathname = '/dashboard'
        return NextResponse.redirect(url)
      }
    }
    // Not authenticated or not yet onboarded → allow onboarding
    return supabaseResponse
  }

  // ── Public routes ──
  if (pathname.startsWith('/invite') || pathname.startsWith('/set-password')) {
    return supabaseResponse
  }

  // ── Register school: public for unauthenticated, redirect if user has school ──
  if (pathname === '/register-school') {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }
    return supabaseResponse
  }

  // ── Public auth routes: allow unauthenticated access ──
  const publicAuthRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/verify-email', '/set-password']
  if (publicAuthRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (user) {
      // Already logged in — redirect to their dashboard/school
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }
    // Not logged in — allow access to sign-in/sign-up
    return supabaseResponse
  }

  // ── Old dashboard/admin routes → redirect to school-scoped ──
  if (pathname.startsWith('/dashboard') || pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // ── Super admin routes: require super admin role ──
  if (pathname.startsWith('/superadmin')) {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }

    const result = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    const profile = result.data as any

    // Check by flag first, then by email match
    let isSuperAdmin = profile?.is_super_admin || false
    if (!isSuperAdmin) {
      try {
        const { data: settings } = await (supabase as any)
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'super_admin_email')
          .single()
        const superAdminEmail = settings?.setting_value?.email
        if (superAdminEmail && user.email?.toLowerCase() === superAdminEmail.toLowerCase()) {
          isSuperAdmin = true
          // Persist the flag so future checks are faster
          await supabase.from('profiles').update({
            is_super_admin: true,
            role: 'super_admin',
            onboarding_complete: true,
            updated_at: new Date().toISOString(),
          }).eq('id', user.id)
        }
      } catch { /* ignore */ }
    }

    if (!isSuperAdmin) {
      // Not a super admin — redirect to their school/dashboard
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }

    return supabaseResponse
  }

  // ── School-scoped routes: /{schoolSlug}/... ──
  const isSchoolRoute = !STATIC_FIRST_SEGMENTS.has(firstSegment) && firstSegment.length > 0
  if (isSchoolRoute) {
    const segments = pathname.split('/')
    const schoolSlug = segments[1]
    const subPath = segments.slice(2).join('/')

    // /{schoolSlug}/sign-in — allow unauthenticated
    if (subPath === 'sign-in') {
      if (user) {
        // Already logged in — check if they belong to this school
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

          if (school?.slug === schoolSlug) {
            const roleRoute = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
            const url = request.nextUrl.clone()
            url.pathname = `/${schoolSlug}/${roleRoute}`
            return NextResponse.redirect(url)
          }
        }
      }
      return supabaseResponse
    }

    // All other school routes require auth
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = `/${schoolSlug}/sign-in`
      return NextResponse.redirect(url)
    }

    // Verify user belongs to this school
    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role, school_id, is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.school_id) {
      // Super admin has no school — redirect to /superadmin, not /onboarding
      if (profile?.is_super_admin) {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin'
        return NextResponse.redirect(url)
      }
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }

    const { data: school } = await supabase
      .from('schools')
      .select('id, slug')
      .eq('slug', schoolSlug)
      .single()

    if (!school || profile.school_id !== school.id) {
      // User doesn't belong to this school — redirect to their own
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request.nextUrl)
    }

    // Admin routes: verify admin role
    if (subPath.startsWith('admin') && profile.role !== 'admin') {
      const roleRoute = profile.role === 'teacher' ? 'teacher' : 'student'
      const url = request.nextUrl.clone()
      url.pathname = `/${schoolSlug}/${roleRoute}`
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  return supabaseResponse
}
