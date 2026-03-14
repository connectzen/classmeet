'use client'

import { Menu } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import UserMenu from './UserMenu'
import { usePathname } from 'next/navigation'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/dashboard/rooms': 'Live Rooms',
  '/dashboard/courses': 'Courses',
  '/dashboard/messages': 'Messages',
  '/dashboard/members': 'Members',
  '/dashboard/analytics': 'Analytics',
  '/dashboard/settings': 'Settings',
  '/admin': 'Admin Panel',
}

export default function TopBar() {
  const { toggleSidebar } = useAppStore()
  const pathname = usePathname()

  const title = Object.entries(PAGE_TITLES).find(([k]) =>
    pathname === k || pathname.startsWith(k + '/')
  )?.[1] ?? 'ClassMeet'

  return (
    <header className="topbar">
      {/* Left: hamburger + page title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          id="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>
        <h1 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          {title}
        </h1>
      </div>

      {/* Right: user menu */}
      <UserMenu />
    </header>
  )
}

