import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { EmailOtpType } from '@supabase/supabase-js'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code       = searchParams.get('code')
  const token_hash = searchParams.get('token_hash')
  const type       = searchParams.get('type') as EmailOtpType | null
  const next       = searchParams.get('next') ?? '/dashboard'

  const supabase = await createClient()

  // PKCE flow (regular sign-up / OAuth)
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/forgot-password?step=password`)
      }
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  // OTP / invite flow — inviteUserByEmail sends token_hash, not a PKCE code
  if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type })
    if (!error) {
      if (type === 'recovery') {
        return NextResponse.redirect(`${origin}/forgot-password?step=password`)
      }
      // For invite type, `next` already points to /set-password (set in redirectTo)
      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback`)
}

