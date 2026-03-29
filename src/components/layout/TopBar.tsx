'use client'

import { useState, useRef, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, Video, BookOpen, MessageSquare, Users, BarChart2, FolderOpen, ChevronDown, HelpCircle } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { useLiveSessionCount } from '@/hooks/useLiveSessionCount'
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount'
import UserMenu from './UserMenu'
import { cn } from '@/lib/utils'
import type { UserRole, TeacherPermissionKey } from '@/lib/supabase/types'
import { canInviteMembers, canCreateGroups, canCreateSessions, canCreateCourses, canManageQuizzes, isOwnerTier } from '@/lib/permissions'

const COMMUNITY_ROLES: UserRole[] = ['teacher', 'admin']

export default function TopBar() {
  const { toggleSidebar, user } = useAppStore()
  const pathname = usePathname()
  const role = user?.role as UserRole | undefined
  const schoolSlug = user?.schoolSlug
  const isCreator = role === 'teacher' || role === 'admin'
  const liveCount = useLiveSessionCount(user?.id, isCreator)
  const unreadMsgCount = useUnreadMessageCount(user?.id)
  const perms = (user?.permissions ?? []) as TeacherPermissionKey[]

  // For teachers who are not owner-tier, check permissions; others see everything
  const needsGating = role === 'teacher' && !isOwnerTier(role, user?.teacherType)
  const hasPerm = (check: (p: TeacherPermissionKey[]) => boolean) => !needsGating || check(perms)

  // Build school-scoped base path
  const basePath = useMemo(() => {
    if (schoolSlug) {
      const roleSegment = role === 'admin' ? 'admin' : role === 'teacher' ? 'teacher' : 'student'
      return `/${schoolSlug}/${roleSegment}/dashboard`
    }
    return '/dashboard'
  }, [schoolSlug, role])

  const dashboardPath = schoolSlug
    ? `/${schoolSlug}/${role === 'admin' ? 'admin' : role === 'teacher' ? 'teacher' : 'student'}`
    : '/dashboard'

  const COMMUNITY_LINKS = useMemo(() => {
    const links: { href: string; label: string; icon: typeof Users }[] = []
    if (hasPerm(canInviteMembers))
      links.push({ href: `${basePath}/members`, label: 'Members', icon: Users })
    if (hasPerm(canCreateGroups))
      links.push({ href: `${basePath}/groups`, label: 'Groups', icon: FolderOpen })
    links.push({ href: `${basePath}/analytics`, label: 'Analytics', icon: BarChart2 })
    return links
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [basePath, needsGating, perms.length])

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
  const MORE_PATHS = [`${basePath}/rooms`, `${basePath}/courses`, `${basePath}/quizzes`, `${basePath}/messages`, ...COMMUNITY_LINKS.map(l => l.href)]
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
            href={dashboardPath}
            className={cn('topbar-nav-link', pathname === dashboardPath && 'active')}
          >
            Dashboard
          </Link>

          {/* Live Rooms */}
          {hasPerm(canCreateSessions) && (
          <Link
            href={`${basePath}/rooms`}
            className={cn('topbar-nav-link', (pathname === `${basePath}/rooms` || pathname.startsWith(`${basePath}/rooms/`)) && 'active')}
          >
            <Video size={14} />
            Live Rooms
            {liveCount > 0 && (
              <span className="topbar-badge">{liveCount}</span>
            )}
          </Link>
          )}

          {/* Courses */}
          {hasPerm(canCreateCourses) && (
          <Link
            href={`${basePath}/courses`}
            className={cn('topbar-nav-link', (pathname === `${basePath}/courses` || pathname.startsWith(`${basePath}/courses/`)) && 'active')}
          >
            <BookOpen size={14} />
            Courses
          </Link>
          )}

          {/* Exams */}
          {hasPerm(canManageQuizzes) && (
          <Link
            href={`${basePath}/quizzes`}
            className={cn('topbar-nav-link', (pathname === `${basePath}/quizzes` || pathname.startsWith(`${basePath}/quizzes/`)) && 'active')}
          >
            <HelpCircle size={14} />
            Exams
          </Link>
          )}

          {/* Messages */}
          <Link
            href={`${basePath}/messages`}
            className={cn('topbar-nav-link', (pathname === `${basePath}/messages` || pathname.startsWith(`${basePath}/messages/`)) && 'active')}
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
            href={dashboardPath}
            className={cn('topbar-nav-link', pathname === dashboardPath && 'active')}
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
                {hasPerm(canCreateSessions) && (
                <Link
                  href={`${basePath}/rooms`}
                  className={cn('topbar-dropdown-item', (pathname === `${basePath}/rooms` || pathname.startsWith(`${basePath}/rooms/`)) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <Video size={15} />
                  Live Rooms
                  {liveCount > 0 && <span className="topbar-badge" style={{ marginLeft: 'auto' }}>{liveCount}</span>}
                </Link>
                )}
                {hasPerm(canCreateCourses) && (
                <Link
                  href={`${basePath}/courses`}
                  className={cn('topbar-dropdown-item', (pathname === `${basePath}/courses` || pathname.startsWith(`${basePath}/courses/`)) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <BookOpen size={15} />
                  Courses
                </Link>
                )}
                {hasPerm(canManageQuizzes) && (
                <Link
                  href={`${basePath}/quizzes`}
                  className={cn('topbar-dropdown-item', (pathname === `${basePath}/quizzes` || pathname.startsWith(`${basePath}/quizzes/`)) && 'active')}
                  onClick={() => setMobileMoreOpen(false)}
                >
                  <HelpCircle size={15} />
                  Exams
                </Link>
                )}
                <Link
                  href={`${basePath}/messages`}
                  className={cn('topbar-dropdown-item', (pathname === `${basePath}/messages` || pathname.startsWith(`${basePath}/messages/`)) && 'active')}
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
