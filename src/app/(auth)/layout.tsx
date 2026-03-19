'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { ReactNode } from 'react'

/**
 * Handles Supabase's implicit-flow tokens that land in the URL hash.
 *
 * inviteUserByEmail sends tokens as #access_token=...&type=invite even
 * when PKCE is enabled for normal auth, because there is no client-initiated
 * PKCE challenge for invite links. The server-side /auth/callback route never
 * sees hash fragments, so the user ends up on /sign-in with the session unused.
 *
 * This effect parses the hash, calls setSession(), then routes the user:
 *   - invited user  → /set-password?next=/invite/[teacherId]
 *   - other (magic) → /dashboard
 */
function ImplicitFlowHandler() {
  const router = useRouter()

  useEffect(() => {
    const hash = window.location.hash
    if (!hash.includes('access_token')) return

    const params      = new URLSearchParams(hash.slice(1)) // strip leading '#'
    const accessToken  = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    if (!accessToken || !refreshToken) return

    // Clear the hash immediately so it isn't visible or reprocessed
    window.history.replaceState(null, '', window.location.pathname + window.location.search)

    const supabase = createClient()

    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ data: { session }, error }) => {
        if (error || !session) return

        const invitedBy = session.user.user_metadata?.invited_by as string | undefined

        if (invitedBy) {
          // Invite flow: user must set a password, then accept the collaboration
          router.replace(
            `/set-password?next=${encodeURIComponent(`/invite/${invitedBy}`)}`
          )
        } else {
          router.replace('/dashboard')
        }
      })
  }, [router])

  return null
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ImplicitFlowHandler />
      {children}
    </>
  )
}
