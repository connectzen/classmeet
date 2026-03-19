import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from './types'

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

  const authRoutes = ['/sign-in', '/sign-up', '/forgot-password', '/verify-email']
  const publicRoutes = ['/invite']
  const isAuthRoute = authRoutes.some(r => pathname.startsWith(r))
  const isPublicRoute = publicRoutes.some(r => pathname.startsWith(r))
  const isProtected = pathname.startsWith('/dashboard') ||
    pathname.startsWith('/admin') ||
    pathname.startsWith('/room') ||
    pathname.startsWith('/onboarding') ||
    pathname.startsWith('/set-password')

  // Allow /invite for everyone (logged in or not)
  if (isPublicRoute) {
    return supabaseResponse
  }

  // Invited users who haven't set a password yet are blocked from everything
  // until they complete /set-password, regardless of how they got here
  // (first link click, second link click, direct navigation, etc.)
  if (
    user &&
    user.user_metadata?.needs_password_setup === true &&
    !pathname.startsWith('/set-password') &&
    !pathname.startsWith('/api/')
  ) {
    const url = request.nextUrl.clone()
    url.pathname = '/set-password'
    url.search = ''
    const invitedBy = user.user_metadata?.invited_by as string | undefined
    if (invitedBy) url.searchParams.set('next', `/invite/${invitedBy}`)
    return NextResponse.redirect(url)
  }

  if (!user && isProtected) {
    const url = request.nextUrl.clone()
    url.pathname = '/sign-in'
    return NextResponse.redirect(url)
  }

  // Migrate legacy 'member' role to 'teacher'
  if (user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role === 'member') {
      await supabase
        .from('profiles')
        .update({ role: 'teacher', updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }
  }

  // Admin routes require admin role
  if (user && pathname.startsWith('/admin')) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()
    if (profile?.role !== 'admin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  if (user && isAuthRoute) {
    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

