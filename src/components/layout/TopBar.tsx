'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Video, BookOpen, MessageSquare, Users, BarChart2, FolderOpen, ChevronDown, HelpCircle } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useLiveSessionCount } from '@/hooks/useLiveSessionCount'
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

  const [communityOpen, setCommunityOpen] = useState(false)
  const communityRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (communityRef.current && !communityRef.current.contains(e.target as Node)) {
        setCommunityOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const showCommunity = role && COMMUNITY_ROLES.includes(role)
  const isCommunityActive = COMMUNITY_LINKS.some(
    ({ href }) => pathname === href || pathname.startsWith(href + '/')
  )

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
      </div>

      {/* Right: user menu */}
      <UserMenu />
    </header>
  )
}
