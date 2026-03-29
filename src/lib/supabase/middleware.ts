import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'
import { resolveUserDestination, roleSegment } from '../routing/user-destination'

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

async function resolveSuperAdminState(
  supabase: ReturnType<typeof createServerClient<Database>>,
  profile: any,
  userId: string,
  userEmail: string,
) {
  let isSuperAdmin = profile?.is_super_admin || profile?.role === 'super_admin' || false

  if (isSuperAdmin) return true

  try {
    const { data: settings } = await (supabase as any)
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'super_admin_email')
      .single()

    const superAdminEmail = settings?.setting_value?.email
    if (superAdminEmail && userEmail.toLowerCase() === superAdminEmail.toLowerCase()) {
      isSuperAdmin = true
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

  return isSuperAdmin
}

/** Redirect helper - resolve canonical destination from role and school assignment */
async function getUserSchoolRedirect(
  supabase: ReturnType<typeof createServerClient<Database>>,
  userId: string,
  userEmail: string,
  request: NextRequest,
  supabasePassthrough: NextResponse,
) {
  const requestUrl = request.nextUrl

  const result = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  const profile = result.data as any
  const isSuperAdmin = await resolveSuperAdminState(supabase, profile, userId, userEmail)

  let schoolSlug: string | null = null
  if (profile?.school_id) {
    const { data: school } = await supabase
      .from('schools')
      .select('slug')
      .eq('id', profile.school_id)
      .single()
    schoolSlug = school?.slug ?? null
  }

  const dest = resolveUserDestination({
    role: profile?.role,
    school_id: profile?.school_id,
    is_super_admin: isSuperAdmin,
  }, schoolSlug)

  if (requestUrl.pathname === dest || requestUrl.pathname.startsWith(dest + '/')) {
    return supabasePassthrough
  }

  const url = requestUrl.clone()
  url.pathname = dest
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

  // API routes always pass through.
  if (pathname.startsWith('/api/') || pathname.startsWith('/auth/')) {
    return supabaseResponse
  }

  // Invited users must finish password setup before accessing app pages.
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

  // Onboarding: only users with role unset may stay here.
  if (pathname === '/onboarding') {
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
    const isSuperAdmin = await resolveSuperAdminState(supabase, profile, user.id, user.email || '')

    if (isSuperAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/superadmin'
      return NextResponse.redirect(url)
    }

    if (profile?.role) {
      if (profile.role === 'admin' && !profile.school_id) {
        const url = request.nextUrl.clone()
        url.pathname = '/register-school'
        return NextResponse.redirect(url)
      }

      if (profile.school_id) {
        const { data: school } = await supabase
          .from('schools')
          .select('slug')
          .eq('id', profile.school_id)
          .single()

        if (school?.slug) {
          const url = request.nextUrl.clone()
          url.pathname = `/${school.slug}/${roleSegment(profile.role)}`
          return NextResponse.redirect(url)
        }
      }

      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  // Public routes.
  if (pathname.startsWith('/invite') || pathname.startsWith('/set-password')) {
    return supabaseResponse
  }

  // Register school is only for signed-in admins without a school.
  if (pathname === '/register-school') {
    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = '/sign-in'
      return NextResponse.redirect(url)
    }

    const result = await supabase.from('profiles').select('*').eq('id', user.id).single()
    const profile = result.data as any

    if (profile?.role === 'admin' && !profile?.school_id) {
      return supabaseResponse
    }

    return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
  }

  // Public auth routes.
  const publicAuthRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/verify-email', '/set-password']
  if (publicAuthRoutes.some(r => pathname === r || pathname.startsWith(r + '/'))) {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
    }
    return supabaseResponse
  }

  // Root and legacy entry routes.
  if (pathname === '/' || pathname.startsWith('/dashboard') || pathname === '/admin' || pathname.startsWith('/admin/')) {
    if (user) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
    }
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Super admin pages require super admin role.
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
    const isSuperAdmin = await resolveSuperAdminState(supabase, profile, user.id, user.email || '')

    if (!isSuperAdmin) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
    }

    return supabaseResponse
  }

  // School-scoped routes: /{schoolSlug}/...
  const isSchoolRoute = !STATIC_FIRST_SEGMENTS.has(firstSegment) && firstSegment.length > 0
  if (isSchoolRoute) {
    const segments = pathname.split('/')
    const schoolSlug = segments[1]
    const subPath = segments.slice(2).join('/')

    if (subPath === 'sign-in') {
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('role, school_id')
          .eq('id', user.id)
          .single()

        if (!profile?.role) {
          const url = request.nextUrl.clone()
          url.pathname = '/onboarding'
          return NextResponse.redirect(url)
        }

        if (profile?.school_id) {
          const { data: school } = await supabase
            .from('schools')
            .select('slug')
            .eq('id', profile.school_id)
            .single()

          if (school?.slug === schoolSlug) {
            const url = request.nextUrl.clone()
            url.pathname = `/${schoolSlug}/${roleSegment(profile.role)}`
            return NextResponse.redirect(url)
          }
        }

        return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
      }
      return supabaseResponse
    }

    if (!user) {
      const url = request.nextUrl.clone()
      url.pathname = `/${schoolSlug}/sign-in`
      return NextResponse.redirect(url)
    }

    const { data: profile } = await (supabase as any)
      .from('profiles')
      .select('role, school_id, is_super_admin')
      .eq('id', user.id)
      .single()

    if (!profile?.role) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    if (!profile?.school_id) {
      if (profile?.is_super_admin || profile?.role === 'super_admin') {
        const url = request.nextUrl.clone()
        url.pathname = '/superadmin'
        return NextResponse.redirect(url)
      }
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
    }

    const { data: school } = await supabase
      .from('schools')
      .select('id, slug')
      .eq('slug', schoolSlug)
      .single()

    if (!school || profile.school_id !== school.id) {
      return getUserSchoolRedirect(supabase, user.id, user.email || '', request, supabaseResponse)
    }

    if (subPath.startsWith('admin') && profile.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = `/${schoolSlug}/${roleSegment(profile.role)}`
      return NextResponse.redirect(url)
    }

    return supabaseResponse
  }

  return supabaseResponse
}
