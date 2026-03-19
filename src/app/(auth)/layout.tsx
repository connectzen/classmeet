'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import type { ReactNode } from 'react'

/**
 * Handles Supabase's implicit-flow tokens that land in the URL hash.
 *
 * inviteUserByEmail uses implicit flow (tokens in #access_token) even when
 * PKCE is enabled for normal auth, because invite links have no client-
 * initiated PKCE challenge. The server-side /auth/callback route never sees
 * hash fragments, so without this handler the user would just see the
 * sign-in form with a valid session sitting unused in the URL.
 *
 * When the hash contains an error (e.g. otp_expired) we show a recovery
 * screen so the user can request a new sign-in link.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  const [phase, setPhase]   = useState<'ready' | 'loading' | 'expired'>('ready')
  const [email, setEmail]   = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent]     = useState(false)
  const [err, setErr]       = useState<string | null>(null)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash) return

    const params = new URLSearchParams(hash.slice(1))

    // Handle error hashes (e.g. #error=access_denied&error_code=otp_expired)
    if (params.get('error')) {
      window.history.replaceState(null, '', window.location.pathname + window.location.search)

      // The invite token is single-use. If the user has any valid session,
      // redirect and let the middleware sort out where they should go
      // (back to /set-password if needs_password_setup is still true, or
      // straight to the invite page if they're already set up).
      // Only show the expired UI when there is genuinely no session.
      const supabase = createClient()
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (session) {
          const next = new URLSearchParams(window.location.search).get('next') ?? '/dashboard'
          window.location.replace(next)
        } else {
          setPhase('expired')
        }
      })
      return
    }

    if (!params.get('access_token')) return

    // Suppress the auth form — user is being signed in via invite token
    setPhase('loading')
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setPhase('ready')
      return
    }

    const supabase = createClient()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data: { session }, error }) => {
        if (error || !session) {
          setPhase('ready')
          return
        }

        const invitedBy = session.user.user_metadata?.invited_by as string | undefined

        // Hard navigation so the (auth) layout remounts fresh at /set-password
        if (invitedBy) {
          window.location.replace(
            `/set-password?next=${encodeURIComponent(`/invite/${invitedBy}`)}`
          )
        } else {
          window.location.replace('/dashboard')
        }
      })
  }, [])

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault()
    const trimmed = email.trim()
    if (!trimmed) { setErr('Please enter your email address.'); return }

    setSending(true)
    setErr(null)

    const supabase = createClient()
    const { error } = await supabase.auth.resetPasswordForEmail(trimmed, {
      redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent('/set-password')}`,
    })

    setSending(false)
    if (error) {
      setErr(error.message)
    } else {
      setSent(true)
    }
  }

  if (phase === 'loading') {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-primary)',
      }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Signing you in&hellip;
        </p>
      </div>
    )
  }

  if (phase === 'expired') {
    return (
      <AuthCard
        title="Invite link expired"
        subtitle="Invite links are only valid for 24 hours. Enter your email and we'll send you a new sign-in link."
      >
        {sent ? (
          <div className="alert alert-success animate-fade-in" style={{ marginTop: '8px' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>Check your inbox — a new sign-in link is on its way.</span>
          </div>
        ) : (
          <form
            onSubmit={handleRecovery}
            style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '8px' }}
          >
            {err && (
              <div className="alert alert-error animate-fade-in">
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{err}</span>
              </div>
            )}

            <Input
              label="Your email address"
              type="email"
              required
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              leftIcon={<Mail size={15} />}
              autoComplete="email"
              autoFocus
            />

            <Button type="submit" loading={sending} style={{ width: '100%' }}>
              Send new sign-in link
            </Button>
          </form>
        )}
      </AuthCard>
    )
  }

  return <>{children}</>
}
