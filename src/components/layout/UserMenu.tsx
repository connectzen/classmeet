'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, User, Settings, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import { usePresenceStore } from '@/store/presence-store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import ProfileModal from '@/components/layout/ProfileModal'

export default function UserMenu() {
  const router = useRouter()
  const { user, setUser } = useAppStore()
  const [open, setOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  async function handleSignOut() {
    const supabase = createClient()
    // Untrack from the actual Realtime Presence channel + mark offline in DB
    if (user?.id) {
      const presenceStore = usePresenceStore.getState()
      // Untrack the real channel (same instance AppStoreHydrator created)
      if (presenceStore.channel) {
        await presenceStore.channel.untrack()
        await supabase.removeChannel(presenceStore.channel)
      }
      presenceStore.reset()
      // Update DB last_seen
      const past = new Date(Date.now() - 120_000).toISOString()
      await supabase.from('profiles').update({ last_seen: past }).eq('id', user.id)
    }
    await supabase.auth.signOut()
    setUser(null)
    router.push('/sign-in')
    router.refresh()
  }

  if (!user) return null

  return (
    <>
      <div style={{ position: 'relative' }} ref={ref}>
        <button
          className="btn btn-ghost"
          style={{ padding: '6px 10px', gap: '8px', borderRadius: 'var(--radius-lg)' }}
          onClick={() => setOpen((o) => !o)}
          aria-haspopup="true"
          aria-expanded={open}
        >
          <Avatar src={user.avatarUrl} name={user.fullName} size="sm" />
          <span style={{ fontSize: '0.875rem', fontWeight: 500, maxWidth: '120px' }} className="truncate">
            {user.fullName || user.email}
          </span>
          <ChevronDown size={14} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }} />
        </button>

        {open && (
          <div className="dropdown" style={{ right: 0, top: 'calc(100% + 8px)', minWidth: '220px' }}>
            {/* User info */}
            <div style={{ padding: '10px 12px 8px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '4px' }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }} className="truncate">
                {user.fullName || 'User'}
              </div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '6px' }} className="truncate">
                {user.email}
              </div>
              <Badge role={user.role} />
            </div>

            <button className="dropdown-item" onClick={() => { setProfileOpen(true); setOpen(false) }}>
              <User size={15} /> Edit profile
            </button>
            <button className="dropdown-item" onClick={() => { router.push('/dashboard/settings'); setOpen(false) }}>
              <Settings size={15} /> Settings
            </button>

            <div className="dropdown-separator" />

            <button className="dropdown-item" onClick={handleSignOut}>
              <LogOut size={15} /> Sign out
            </button>
          </div>
        )}
      </div>

      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} />}
    </>
  )
}

