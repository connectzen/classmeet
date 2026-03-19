'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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
 * When a hash is detected we suppress the auth page entirely (no flash)
 * and show a brief "Signing you in…" message while setSession() runs.
 * On success the middleware's needs_password_setup guard takes over and
 * forces the user to /set-password before they can go anywhere else.
 */
export default function AuthLayout({ children }: { children: ReactNode }) {
  // Start ready=true so normal sign-in users never see a spinner.
  // If we detect a hash token we'll flip to false before the first paint.
  const [ready, setReady] = useState(true)

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return

    // Suppress the auth form immediately — user is being signed in via invite
    setReady(false)

    // Remove the tokens from the URL bar right away
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    const params      = new URLSearchParams(hash.slice(1))
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')

    if (!accessToken || !refreshToken) {
      setReady(true) // nothing useful in the hash, show auth page normally
      return
    }

    const supabase = createClient()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data: { session }, error }) => {
        if (error || !session) {
          // Token expired or already used — show the sign-in page normally
          setReady(true)
          return
        }

        // Session established. The middleware's needs_password_setup guard
        // will redirect to /set-password on the next navigation.
        // We still do an explicit redirect here so the user doesn't linger
        // on the spinner if the middleware check ever misses for some reason.
        const invitedBy = session.user.user_metadata?.invited_by as string | undefined

        // Use window.location (hard navigation) instead of router.replace so
        // the (auth) layout remounts fresh and doesn't stay stuck on the
        // "Signing you in…" spinner — /set-password shares this layout.
        if (invitedBy) {
          window.location.replace(
            `/set-password?next=${encodeURIComponent(`/invite/${invitedBy}`)}`
          )
        } else {
          window.location.replace('/dashboard')
        }
      })
  }, [])

  if (!ready) {
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

  return <>{children}</>
}
