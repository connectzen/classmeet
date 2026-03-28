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
])

/** Redirect helper — look up user's school and build /{slug}/{role} path */
async function getUserSchoolRedirect(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  requestUrl: NextRequest['nextUrl'],
) {
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, school_id')
    .eq('id', userId)
    .single()

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

  // No school — send to registration
  const url = requestUrl.clone()
  url.pathname = '/register-school'
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

  // ── Public routes ──
  if (pathname.startsWith('/invite') || pathname.startsWith('/set-password') || pathname.startsWith('/onboarding')) {
    return supabaseResponse
  }

  // ── Register school: public for unauthenticated, redirect if user has school ──
  if (pathname === '/register-school') {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, request.nextUrl)
    }
    return supabaseResponse
  }

  // ── Old auth routes → redirect ──
  const oldAuthRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/verify-email']
  if (oldAuthRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, request.nextUrl)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/register-school'
    return NextResponse.redirect(url)
  }

  // ── Old dashboard/admin routes → redirect to school-scoped ──
  if (pathname.startsWith('/dashboard') || pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, request.nextUrl)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/register-school'
    return NextResponse.redirect(url)
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
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!profile?.school_id) {
      const url = request.nextUrl.clone()
      url.pathname = '/register-school'
      return NextResponse.redirect(url)
    }

    const { data: school } = await supabase
      .from('schools')
      .select('id, slug')
      .eq('slug', schoolSlug)
      .single()

    if (!school || profile.school_id !== school.id) {
      // User doesn't belong to this school — redirect to their own
      return getUserSchoolRedirect(supabase, user.id, request.nextUrl)
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
