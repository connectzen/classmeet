'use client'

import { useMemo } from 'react'
import { Menu, Radio } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useLiveSessionCount } from '@/hooks/useLiveSessionCount'
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount'
import UserMenu from './UserMenu'

export default function TopBar() {
  const { toggleSidebar, user } = useAppStore()
  const isCreator = user?.role === 'teacher' || user?.role === 'admin'
  const liveCount = useLiveSessionCount(user?.id, isCreator)
  const unreadMsgCount = useUnreadMessageCount(user?.id)

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  const firstName = user?.fullName?.split(' ')[0] ?? 'there'

  return (
    <header className="topbar">
      {/* Left: hamburger + live indicator + greeting */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          id="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        {/* Live indicator */}
        <div className="topbar-live-indicator">
          <span className="topbar-live-dot" />
          <Radio size={14} className="topbar-live-icon" />
          <span className="topbar-live-text">LIVE</span>
          {liveCount > 0 && (
            <span className="topbar-live-count">{liveCount}</span>
          )}
        </div>

        {/* Greeting */}
        <div className="topbar-greeting">
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500 }}>
            {greeting}, <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{firstName}</span>
          </span>
          {unreadMsgCount > 0 && (
            <span className="topbar-badge topbar-badge-msg" style={{ marginLeft: '8px' }}>
              {unreadMsgCount > 9 ? '9+' : unreadMsgCount} msg
            </span>
          )}
        </div>
      </div>

      {/* Right: user menu */}
      <UserMenu />
    </header>
  )
}
