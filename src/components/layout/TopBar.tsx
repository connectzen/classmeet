'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Video, BookOpen, MessageSquare, Users, BarChart2, FolderOpen, ChevronDown, HelpCircle } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useLiveSessionCount } from '@/hooks/useLiveSessionCount'
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount'
import UserMenu from './UserMenu'
import { cn } from '@/lib/utils'
import type { UserRole } from '@/lib/supabase/types'

const COMMUNITY_LINKS = [
  { href: '/dashboard/members',   label: 'Members',   icon: Users     },
  { href: '/dashboard/groups',    label: 'Groups',    icon: FolderOpen },
  { href: '/dashboard/analytics', label: 'Analytics', icon: BarChart2  },
]

const COMMUNITY_ROLES: UserRole[] = ['teacher', 'member', 'admin']

export default function TopBar() {
  const { toggleSidebar, user } = useAppStore()
  const pathname = usePathname()
  const role = user?.role as UserRole | undefined
  const isCreator = role === 'teacher' || role === 'member' || role === 'admin'
  const liveCount = useLiveSessionCount(user?.id, isCreator)
  const unreadMsgCount = useUnreadMessageCount(user?.id)

  const [communityOpen, setCommunityOpen] = useState(false)
  const communityRef = useRef<HTMLDivElement>(null)
  const [mobileMoreOpen, setMobileMoreOpen] = useState(false)
  const mobileMoreRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (communityRef.current && !communityRef.current.contains(e.target as Node)) {
        setCommunityOpen(false)
      }
      if (mobileMoreRef.current && !mobileMoreRef.current.contains(e.target as Node)) {
        setMobileMoreOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const showCommunity = role && COMMUNITY_ROLES.includes(role)
  const isCommunityActive = COMMUNITY_LINKS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + '/')
  )
  const MORE_PATHS = ['/dashboard/rooms', '/dashboard/courses', '/dashboard/quizzes', '/dashboard/messages', ...COMMUNITY_LINKS.map(l => l.href)]
  const isMoreActive = MORE_PATHS.some(p => pathname === p || pathname.startsWith(p + '/'))

  return (
    <header className="topbar">
      {/* Left: hamburger + nav links */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <button
          className="btn btn-ghost btn-icon btn-sm"
          id="sidebar-toggle"
          onClick={toggleSidebar}
          aria-label="Toggle sidebar"
        >
          <Menu size={20} />
        </button>

        <nav className="topbar-nav" aria-label="Main navigation">
          {/* Dashboard */}
          <Link
            href="/dashboard"
            className={cn('topbar-nav-link', pathname === '/dashboard' && 'active')}
          >
            Dashboard
          </Link>

          {/* Live Rooms */}
          <Link
            href="/dashboard/rooms"
            className={cn('topbar-nav-link', (pathname === '/dashboard/rooms' || pathname.startsWith('/dashboard/rooms/')) && 'active')}
          >
            <Video size={14} />
            Live Rooms
            {liveCount > 0 && (
              <span className="topbar-badge">{liveCount}</span>
            )}
          </Link>

          {/* Courses */}
          <Link
            href="/dashboard/courses"
            className={cn('topbar-nav-link', (pathname === '/dashboard/courses' || pathname.startsWith('/dashboard/courses/')) && 'active')}
          >
            <BookOpen size={14} />
            Courses
          </Link>

          {/* Quizzes */}
          <Link
            href="/dashboard/quizzes"
            className={cn('topbar-nav-link', (pathname === '/dashboard/quizzes' || pathname.startsWith('/dashboard/quizzes/')) && 'active')}
          >
            <HelpCircle size={14} />
            Quizzes
          </Link>

          {/* Messages */}
          <Link
            href="/dashboard/messages"
            className={cn('topbar-nav-link', (pathname === '/dashboard/messages' || pathname.startsWith('/dashboard/messages/')) && 'active')}
          >
            <MessageSquare size={14} />
            Messages
            {unreadMsgCount > 0 && (
              <span key={unreadMsgCount} className="topbar-badge topbar-badge-msg">
                {unreadMsgCount > 9 ? '9+' : unreadMsgCount}
              </span>
            )}
          </Link>

          {/* Community dropdown */}
          {showCommunity && (
            <div ref={communityRef} style={{ position: 'relative' }}>
              <button
                className={cn('topbar-nav-link', isCommunityActive && 'active')}
                onClick={() => setCommunityOpen(o => !o)}
              >
                <Users size={14} />
                Community
                <ChevronDown
                  size={12}
                  style={{
                    transition: 'transform 0.2s',
                    transform: communityOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}
                />
              </button>

              {communityOpen && (
                <div className="topbar-dropdown">
                  {COMMUNITY_LINKS.map(({ href, label, icon: Icon }) => {
                    const isActive = pathname === href || pathname.startsWith(href + '/')
                    return (
                      <Link
                        key={href}
                        href={href}
                        className={cn('topbar-dropdown-item', isActive && 'active')}
                        onClick={() => setCommunityOpen(false)}
                      >
                        <Icon size={15} />
                        {label}
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </nav>

        {/* Mobile nav: Dashboard + More dropdown */}
        <nav className="topbar-nav-mobile" aria-label="Mobile navigation">
          <Link
            href="/dashboard"
            className={cn('topbar-nav-link', pathname === '/dashboard' && 'active')}
          >
            Dashboard
          </Link>

          <div ref={mobileMoreRef} style={{ position: 'relative' }}>
            <button
              className={cn('topbar-nav-link', isMoreActive && 'active')}
              onClick={() => setMobileMoreOpen(o => !o)}
            >
              More
              <ChevronDown
                size={12}
                style={{ transition: 'transform 0.2s', transform: mobileMoreOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}
              />
            </button>

            {mobileMoreOpen && (
              <div className="topbar-dropdown topbar-more-dropdown">
                <Link
                  href="/dashboard/rooms"
                  className={cn('topbar-dropdown-item', (pathname === '/dashboard/rooms' || pathname.startsWith('/dashboard/rooms/')) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <Video size={15} />
                  Live Rooms
                  {liveCount > 0 && <span className="topbar-badge" style={{ marginLeft: 'auto' }}>{liveCount}</span>}
                </Link>
                <Link
                  href="/dashboard/courses"
                  className={cn('topbar-dropdown-item', (pathname === '/dashboard/courses' || pathname.startsWith('/dashboard/courses/')) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <BookOpen size={15} />
                  Courses
                </Link>
                <Link
                  href="/dashboard/quizzes"
                  className={cn('topbar-dropdown-item', (pathname === '/dashboard/quizzes' || pathname.startsWith('/dashboard/quizzes/')) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <HelpCircle size={15} />
                  Quizzes
                </Link>
                <Link
                  href="/dashboard/messages"
                  className={cn('topbar-dropdown-item', (pathname === '/dashboard/messages' || pathname.startsWith('/dashboard/messages/')) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <MessageSquare size={15} />
                  Messages
                  {unreadMsgCount > 0 && <span className="topbar-badge topbar-badge-msg" style={{ marginLeft: 'auto' }}>{unreadMsgCount > 9 ? '9+' : unreadMsgCount}</span>}
                </Link>
                {showCommunity && (
                  <>
                    <div className="topbar-dropdown-divider" />
                    {COMMUNITY_LINKS.map(({ href, label, icon: Icon }) => (
                      <Link
                        key={href}
                        href={href}
                        className={cn('topbar-dropdown-item', (pathname === href || pathname.startsWith(href + '/')) && 'active')}
                        onClick={() => setMobileMoreOpen(false)}
                      >
                        <Icon size={15} />
                        {label}
                      </Link>
                    ))}
                  </>
                )}
              </div>
            )}
          </div>
        </nav>
      </div>

      {/* Right: user menu */}
      <UserMenu />
    </header>
  )
}
