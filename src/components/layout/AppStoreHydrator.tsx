'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { useAppStore } from '@/store/app-store'
import { usePresenceStore } from '@/store/presence-store'
import type { PresenceUser } from '@/store/presence-store'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import type { RealtimeChannel } from '@supabase/supabase-js'

interface Props {
  user: {
    id: string
    email: string
    fullName: string
    avatarUrl: string | null
    role: UserRole | string
    onboardingComplete: boolean
    schoolId?: string | null
    schoolSlug?: string | null
    isSuperAdmin?: boolean
  }
  children: ReactNode
}

const PRESENCE_CHANNEL_PREFIX = 'classmeet-presence'
const DB_HEARTBEAT_INTERVAL = 60_000 // Update DB last_seen every 60s

export default function AppStoreHydrator({ user, children }: Props) {
  const setUser = useAppStore((s) => s.setUser)
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    setUser({
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      avatarUrl: user.avatarUrl,
      role: (user.role as UserRole) ?? 'student',
      onboardingComplete: user.onboardingComplete,
      schoolId: user.schoolId ?? null,
      schoolSlug: user.schoolSlug ?? null,
      isSuperAdmin: user.isSuperAdmin ?? false,
    })
  }, [user, setUser])

  // ── Supabase Realtime Presence ──
  useEffect(() => {
    const supabase = createClient()
    const store = usePresenceStore.getState
    let destroyed = false

    const myPresence: PresenceUser = {
      userId: user.id,
      name: user.fullName || user.email,
      avatarUrl: user.avatarUrl,
      onlineAt: new Date().toISOString(),
    }

    // Helper: extract all online users from presence state
    function collectPresenceUsers(state: Record<string, PresenceUser[]>): PresenceUser[] {
      const users: PresenceUser[] = []
      for (const key of Object.keys(state)) {
        const list = state[key]
        if (list && list.length > 0) users.push(list[0])
      }
      return users
    }

    // Scope presence channel to school if available
    const presenceChannel = user.schoolId
      ? `${PRESENCE_CHANNEL_PREFIX}-${user.schoolId}`
      : PRESENCE_CHANNEL_PREFIX

    // Remove any stale presence channels left over from a previous session
    // (e.g. singleton Supabase client survived a sign-out → sign-in cycle)
    for (const ch of supabase.getChannels()) {
      if (ch.subTopic === presenceChannel) {
        supabase.removeChannel(ch)
      }
    }

    // Set up the presence channel
    const channel = supabase.channel(presenceChannel, {
      config: { presence: { key: user.id } },
    })

    channelRef.current = channel

    channel
      .on('presence', { event: 'sync' }, () => {
        if (destroyed) return
        const state = channel.presenceState<PresenceUser>()
        store().syncAll(collectPresenceUsers(state))
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        if (destroyed) return
        for (const p of newPresences as unknown as PresenceUser[]) {
          if (p.userId) store().setOnline(p)
        }
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        if (destroyed) return
        for (const p of leftPresences as unknown as PresenceUser[]) {
          if (p.userId) store().setOffline(p.userId)
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED' && !destroyed) {
          await channel.track(myPresence)
          store().setChannel(channel)
        }
        // Retry once on transient errors
        if ((status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') && !destroyed) {
          channel.subscribe()
        }
      })

    // ── DB fallback: update last_seen for offline queries ──
    const markOnlineDB = () => {
      if (destroyed) return
      supabase.from('profiles').update({ last_seen: new Date().toISOString() }).eq('id', user.id).then(() => {})
    }

    const handleBeforeUnload = () => {
      // untrack() tells the Realtime server we're leaving – other clients
      // get the "leave" event immediately.  DB last_seen will naturally go
      // stale once the heartbeat stops (within 60 s).
      channel.untrack()
    }

    // Only update DB heartbeat on visibility change — do NOT untrack/retrack presence
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        markOnlineDB()
      }
    }

    // Mark online in DB immediately
    markOnlineDB()

    // DB heartbeat
    const dbInterval = setInterval(markOnlineDB, DB_HEARTBEAT_INTERVAL)

    window.addEventListener('beforeunload', handleBeforeUnload)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      destroyed = true
      clearInterval(dbInterval)
      window.removeEventListener('beforeunload', handleBeforeUnload)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      channelRef.current = null
      // Only clean up if the channel hasn't been removed already (e.g. by sign-out)
      if (store().channel === channel) {
        channel.untrack()
        supabase.removeChannel(channel)
        store().setChannel(null)
      }
    }
  }, [user.id]) // Only re-run if the user changes

  return <>{children}</>
}

