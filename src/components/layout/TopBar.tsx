'use client'

import { useMemo, useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Radio, ChevronDown, MoreVertical } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useLiveSessionCount } from '@/hooks/useLiveSessionCount'
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount'
import { getDashboardBasePath } from '@/lib/utils'
import { canInviteMembers, canCreateGroups, canCreateCourses, canCreateSessions, canManageQuizzes } from '@/lib/permissions'
import { Video, BookOpen, MessageSquare, Users, FolderOpen, HelpCircle, BarChart2 } from 'lucide-react'
import type { TeacherPermissionKey } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'
import UserMenu from './UserMenu'

export default function TopBar() {
  const { toggleSidebar, user } = useAppStore()
  const pathname = usePathname()
  const isCreator = user?.role === 'teacher' || user?.role === 'admin'
  const liveCount = useLiveSessionCount(user?.id, isCreator)
  const unreadMsgCount = useUnreadMessageCount(user?.id)
  const [navOpen, setNavOpen] = useState(false)
  const navRef = useRef<HTMLDivElement>(null)

  const basePath = getDashboardBasePath(user)
  const permissions = (user?.permissions ?? []) as TeacherPermissionKey[]

  // Build nav links
  const navLinks = useMemo(() => {
    if (!user) return []
    const isTeacher = user.role === 'teacher'
    const links: { href: string; label: string; icon: React.ElementType; badge?: number }[] = [
      { href: `${basePath}/rooms`, label: 'Live Rooms', icon: Video },
      { href: `${basePath}/courses`, label: 'Courses', icon: BookOpen },
      { href: `${basePath}/messages`, label: 'Messages', icon: MessageSquare, badge: unreadMsgCount },
    ]
    if (isTeacher) {
      if (canInviteMembers(permissions)) links.push({ href: `${basePath}/members`, label: 'Members', icon: Users })
      if (canCreateGroups(permissions)) links.push({ href: `${basePath}/groups`, label: 'Groups', icon: FolderOpen })
      if (canManageQuizzes(permissions)) links.push({ href: `${basePath}/quizzes`, label: 'Quizzes', icon: HelpCircle })
      links.push({ href: `${basePath}/analytics`, label: 'Analytics', icon: BarChart2 })
    }
    return links
  }, [user, basePath, permissions, unreadMsgCount])

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (navRef.current && !navRef.current.contains(e.target as Node)) setNavOpen(false)
    }
    if (navOpen) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [navOpen])

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
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', minWidth: 0, flex: 1 }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          id="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
          style={{ flexShrink: 0 }}
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
        <div className="topbar-greeting" style={{ minWidth: 0, overflow: 'hidden' }}>
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {greeting},<span className="topbar-greeting-name" style={{ color: 'var(--text-primary)', fontWeight: 600 }}> {firstName}</span>
          </span>
        </div>

        {/* User menu - next to greeting on mobile, pushed right on desktop */}
        <div className="topbar-user-menu-wrapper">
          <UserMenu />
        </div>
      </div>

      {/* Right: nav/more dropdown */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
        {/* Navigation dropdown */}
        {navLinks.length > 0 && (
          <div ref={navRef} style={{ position: 'relative' }}>
            <button
              className={cn('topbar-nav-link', navOpen && 'active')}
              onClick={() => setNavOpen(o => !o)}
              aria-expanded={navOpen}
              aria-haspopup="true"
              aria-label="More actions"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <MoreVertical size={16} />
              <span className="topbar-nav-label-desktop">Navigate</span>
              <span className="topbar-nav-label-mobile">More</span>
              <ChevronDown size={14} style={{ transition: 'transform 0.15s', transform: navOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
            </button>

            {navOpen && (
              <div className="topbar-dropdown topbar-more-dropdown" style={{ right: 0, left: 'auto' }}>
                {navLinks.map(link => {
                  const Icon = link.icon
                  const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn('topbar-dropdown-item', isActive && 'active')}
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon size={15} />
                      {link.label}
                      {link.badge !== undefined && link.badge > 0 && (
                        <span className="topbar-badge" style={{ marginLeft: 'auto' }}>{link.badge > 9 ? '9+' : link.badge}</span>
                      )}
                    </Link>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </header>
  )
}
