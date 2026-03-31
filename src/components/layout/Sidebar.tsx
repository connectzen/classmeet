'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { usePresenceStore } from '@/store/presence-store'
import { useSchool } from '@/lib/school-context'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import { canInviteMembers, canCreateGroups, canCreateCourses, canCreateSessions, canManageQuizzes, canManageBranding, isOwnerTier } from '@/lib/permissions'
import Avatar from '@/components/ui/Avatar'
import { Video, Settings, ShieldCheck, X, Circle, GraduationCap, Users, AlertCircle, BookOpen, FolderOpen, HelpCircle, MessageSquare, BarChart2, UserPlus, Palette, LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useUnreadMessageCount } from '@/hooks/useUnreadMessageCount'
import Image from 'next/image'

type NavLink = { href: string; label: string; icon: React.ElementType; roles?: UserRole[]; badgeKey?: string; permissionCheck?: (perms: string[]) => boolean }
type NavSection = { section: string; links: NavLink[] }

function getNavLinks(schoolSlug: string | null, role: UserRole | undefined, permissions: string[]): NavSection[] {
  const basePath = schoolSlug
    ? `/${schoolSlug}/${role === 'admin' ? 'admin' : role === 'teacher' ? 'teacher' : 'student'}`
    : '/dashboard'

  const isTeacher = role === 'teacher'

  const sections: NavSection[] = []

  // Teacher/Student dashboard links
  if (isTeacher || role === 'student') {
    const dashLinks: NavLink[] = [
      { href: `${basePath}/dashboard`, label: 'Dashboard', icon: LayoutDashboard },
      { href: `${basePath}/dashboard/rooms`, label: 'Live Rooms', icon: Video, badgeKey: 'rooms', permissionCheck: (p) => role === 'student' || canCreateSessions(p as any) },
      { href: `${basePath}/dashboard/courses`, label: 'Courses', icon: BookOpen, badgeKey: 'courses', permissionCheck: (p) => role === 'student' || canCreateCourses(p as any) },
      { href: `${basePath}/dashboard/messages`, label: 'Messages', icon: MessageSquare, badgeKey: 'messages' },
    ]

    if (isTeacher) {
      if (canInviteMembers(permissions as any)) {
        dashLinks.push({ href: `${basePath}/dashboard/members`, label: 'Members', icon: Users, badgeKey: 'members' })
      }
      if (canCreateGroups(permissions as any)) {
        dashLinks.push({ href: `${basePath}/dashboard/groups`, label: 'Groups', icon: FolderOpen, badgeKey: 'groups' })
      }
      if (canManageQuizzes(permissions as any)) {
        dashLinks.push({ href: `${basePath}/dashboard/quizzes`, label: 'Quizzes', icon: HelpCircle, badgeKey: 'quizzes' })
      }
      dashLinks.push({ href: `${basePath}/dashboard/analytics`, label: 'Analytics', icon: BarChart2 })
    }

    sections.push({ section: '', links: dashLinks })
  }

  // System section
  const systemLinks: NavLink[] = [
    { href: `${basePath}/dashboard/settings`, label: 'Settings', icon: Settings },
  ]

  if (isTeacher && canManageBranding(role, useAppStore.getState().user?.teacherType)) {
    systemLinks.push({ href: `${basePath}/dashboard/settings/branding`, label: 'Branding', icon: Palette })
  }
  if (isTeacher && isOwnerTier(role, useAppStore.getState().user?.teacherType)) {
    systemLinks.push({ href: `${basePath}/dashboard/team`, label: 'Team', icon: UserPlus })
  }
  sections.push({ section: 'System', links: systemLinks })

  return sections
}

// ── Offline status helper (DB last_seen for offline users) ──
function formatLastSeen(lastSeen: string | null): string {
  if (!lastSeen) return 'Never seen'
  const diff = Date.now() - new Date(lastSeen).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `Last seen ${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `Last seen ${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `Last seen ${days}d ago`
  return `Last seen ${new Date(lastSeen).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}`
}

// ── Types for sidebar people ──
interface SidebarPerson {
  id: string
  full_name: string | null
  avatar_url: string | null
  last_seen: string | null
}

// ── Sidebar person row (shared between Students and Collaboration) ──
function PersonRow({ p, fallbackName, isOnline }: { p: SidebarPerson & { role?: string }; fallbackName: string; isOnline: boolean }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px',
      padding: '8px 12px', margin: '2px 8px', borderRadius: '8px',
      background: 'var(--bg-elevated)', transition: 'background 0.15s',
    }}>
      <Avatar src={p.avatar_url} name={p.full_name} size="sm" online={isOnline} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 500,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {p.full_name || fallbackName}
        </div>
        <div style={{
          fontSize: '0.68rem',
          color: isOnline ? 'var(--success-400)' : 'var(--text-muted)',
          display: 'flex', alignItems: 'center', gap: '4px', marginTop: '1px',
        }}>
          <Circle size={6} fill={isOnline ? 'var(--success-400)' : 'var(--text-disabled)'} color={isOnline ? 'var(--success-400)' : 'var(--text-disabled)'} />
          {isOnline ? 'Online' : formatLastSeen(p.last_seen)}
        </div>
      </div>
    </div>
  )
}

// ── Teacher contacts (for teachers) — splits by role into Students + Collaboration ──
function StudentList({ teacherId }: { teacherId: string }) {
  const [contacts, setContacts] = useState<(SidebarPerson & { role: string })[]>([])
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      // Query both sides: people I teach, AND teachers who added me as a co-teacher
      const [{ data: asTeacher }, { data: asStudent }] = await Promise.all([
        supabase.from('teacher_students').select('student_id').eq('teacher_id', teacherId),
        supabase.from('teacher_students').select('teacher_id').eq('student_id', teacherId),
      ])

      const ids = [
        ...( asTeacher?.map(e => e.student_id) ?? []),
        ...( asStudent?.map(e => e.teacher_id)  ?? []),
      ]
      const uniqueIds = [...new Set(ids)]

      if (uniqueIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, last_seen, role')
          .in('id', uniqueIds)

        if (profiles) setContacts(profiles as (SidebarPerson & { role: string })[])
      } else {
        setContacts([])
      }
    }

    load()

    // Single channel for both sides with debouncing
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedLoad = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(load, 300)
    }

    const ch = supabase
      .channel(`sidebar-enrollments-${teacherId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students', filter: `teacher_id=eq.${teacherId}` }, debouncedLoad)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students', filter: `student_id=eq.${teacherId}` }, debouncedLoad)
      .subscribe()

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      supabase.removeChannel(ch)
    }
  }, [teacherId])

  const collabs  = contacts.filter(c => c.role === 'teacher' || c.role === 'admin')
  const students = contacts.filter(c => !collabs.some(co => co.id === c.id))

  return (
    <>
      {/* Students */}
      <div className="sidebar-section" style={{ marginBottom: '4px' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <GraduationCap size={12} />
          My Students
          {students.length > 0 && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px',
              borderRadius: '9999px', background: 'rgba(245,158,11,0.15)',
              color: '#f59e0b', marginLeft: 'auto',
            }}>{students.length}</span>
          )}
        </div>
        {students.length === 0
          ? <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 16px' }}>No students assigned yet</p>
          : students.map(s => <PersonRow key={s.id} p={s} fallbackName="Student" isOnline={onlineUsers.has(s.id)} />)
        }
      </div>

      {/* Collaboration teachers */}
      <div className="sidebar-section" style={{ marginBottom: '4px' }}>
        <div className="sidebar-section-label" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Users size={12} />
          Co-Teachers
          {collabs.length > 0 && (
            <span style={{
              fontSize: '0.62rem', fontWeight: 700, padding: '1px 6px',
              borderRadius: '9999px', background: 'rgba(16,185,129,0.15)',
              color: '#10b981', marginLeft: 'auto',
            }}>{collabs.length}</span>
          )}
        </div>
        {collabs.length === 0
          ? <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', padding: '4px 16px', fontStyle: 'italic' }}>None yet</p>
          : collabs.map(c => <PersonRow key={c.id} p={c} fallbackName="Teacher" isOnline={onlineUsers.has(c.id)} />)
        }
      </div>
    </>
  )
}

// ── Teacher Info (for students) ── Uses Realtime Presence for instant status ──
function TeacherInfo({ studentId }: { studentId: string }) {
  const [teachers, setTeachers] = useState<SidebarPerson[]>([])
  const onlineUsers = usePresenceStore((s) => s.onlineUsers)

  useEffect(() => {
    const supabase = createClient()

    const loadTeachers = async () => {
      const { data: enrollments } = await supabase
        .from('teacher_students')
        .select('teacher_id')
        .eq('student_id', studentId)

      if (enrollments && enrollments.length > 0) {
        const ids = enrollments.map(e => e.teacher_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, last_seen')
          .in('id', ids)

        if (profiles) setTeachers(profiles as SidebarPerson[])
      } else {
        setTeachers([])
      }
    }

    loadTeachers()

    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedLoad = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(loadTeachers, 300)
    }

    const channel = supabase
      .channel(`sidebar-teacher-${studentId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students', filter: `student_id=eq.${studentId}` }, debouncedLoad)
      .subscribe()

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      supabase.removeChannel(channel)
    }
  }, [studentId])

  if (teachers.length === 0) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-section-label">My Teachers</div>
        <div style={{
          margin: '8px 12px',
          padding: '12px 14px',
          backgroundColor: 'rgba(59, 130, 246, 0.08)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          borderRadius: '8px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500, marginBottom: '4px' }}>
            Welcome to ClassMeet!
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
            Awaiting teacher assignment or join a classroom
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="sidebar-section">
      <div className="sidebar-section-label">{teachers.length === 1 ? 'My Teacher' : 'My Teachers'}</div>
      {teachers.map(teacher => {
        const online = onlineUsers.has(teacher.id)
        return (
          <div key={teacher.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 16px' }}>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="sm" online={online} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{teacher.full_name || 'Teacher'}</div>
              <div style={{ fontSize: '0.7rem', color: online ? 'var(--success-400)' : 'var(--text-muted)' }}>
                {online ? '● Online' : formatLastSeen(teacher.last_seen)}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Admin Overview (for admins) — clickable links to admin sub-pages ──
function AdminOverview() {
  const [counts, setCounts] = useState({ teachers: 0, students: 0, classes: 0 })
  const school = useSchool()

  useEffect(() => {
    const supabase = createClient()
    const schoolId = school?.schoolId
    if (!schoolId) return

    const load = async () => {
      try {
        const [teachersRes, studentsRes, classesRes] = await Promise.all([
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'teacher'),
          supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', schoolId).eq('role', 'student'),
          supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', schoolId),
        ])
        setCounts({
          teachers: teachersRes.count ?? 0,
          students: studentsRes.count ?? 0,
          classes: classesRes.count ?? 0,
        })
      } catch {
        // Silently fail for sidebar counts
      }
    }

    load()

    const ch1 = supabase
      .channel('sidebar-admin-profiles')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(ch1) }
  }, [school?.schoolId])

  const slug = school?.schoolSlug
  const pathname = usePathname()

  const adminLink = (href: string, icon: React.ReactNode, label: string, count: number) => {
    const isActive = pathname === href || pathname.startsWith(href + '/')
    return (
      <Link href={href} className={cn('sidebar-link', isActive && 'active')}>
        {icon}
        {label}
        {count > 0 && <span className="sidebar-badge">{count}</span>}
      </Link>
    )
  }

  const dashboardHref = `/${slug}/admin`
  const isDashboardActive = pathname === dashboardHref

  return (
    <>
      <div style={{ padding: '4px 0' }}>
        <Link href={dashboardHref} className={cn('sidebar-link', isDashboardActive && 'active')}>
          <LayoutDashboard size={17} className="link-icon" />
          Dashboard
        </Link>
        {adminLink(`/${slug}/admin/teachers`, <GraduationCap size={17} className="link-icon" />, 'Teachers', counts.teachers)}
        {adminLink(`/${slug}/admin/students`, <Users size={17} className="link-icon" />, 'Students', counts.students)}
        {adminLink(`/${slug}/admin/classes`, <BookOpen size={17} className="link-icon" />, 'Classes', counts.classes)}
      </div>
    </>
  )
}

// ── Sidebar nav counts ────────────────────────────────────────────────────────
function useSidebarCounts(userId: string | undefined, role: UserRole | undefined) {
  const [counts, setCounts] = useState<Record<string, number>>({})

  useEffect(() => {
    if (!userId || !role) return
    const supabase = createClient()

    const load = async () => {
      try {
        if (role === 'teacher') {
          const [rooms, courses, quizzes, members, groups] = await Promise.all([
            supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
            supabase.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
            supabase.from('quizzes').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
            supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
            supabase.from('groups').select('id', { count: 'exact', head: true }).eq('teacher_id', userId),
          ])
          setCounts({
            rooms: rooms.count ?? 0,
            courses: courses.count ?? 0,
            quizzes: quizzes.count ?? 0,
            members: members.count ?? 0,
            groups: groups.count ?? 0,
          })
        } else if (role === 'student') {
          const [sessions, courses] = await Promise.all([
            supabase.from('session_targets').select('session_id', { count: 'exact', head: true }).eq('target_type', 'student').eq('target_id', userId),
            supabase.from('course_targets').select('course_id', { count: 'exact', head: true }).eq('target_type', 'student').eq('target_id', userId),
          ])
          setCounts({
            rooms: sessions.count ?? 0,
            courses: courses.count ?? 0,
          })
        }
      } catch {
        // Silently fail for sidebar counts
      }
    }

    load()

    // Refresh counts on relevant table changes
    const tables = role === 'teacher'
      ? ['sessions', 'courses', 'quizzes', 'teacher_students', 'groups']
      : ['session_targets', 'course_targets']
    const channel = supabase
      .channel('sidebar-nav-counts')
    for (const table of tables) {
      channel.on('postgres_changes', { event: '*', schema: 'public', table }, () => load())
    }
    channel.subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, role])

  return counts
}

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, user } = useAppStore()
  const school = useSchool()
  const role = user?.role as UserRole | undefined
  const schoolSlug = user?.schoolSlug ?? null
  const isCreator = role === 'teacher' || role === 'admin'
  const permissions = user?.permissions ?? []
  const NAV = getNavLinks(schoolSlug, role, permissions)

  // Extract only the System section for the sidebar bottom
  const systemSection = NAV.find(s => s.section === 'System')
  // Extract the Dashboard link from the main nav section
  const mainSection = NAV.find(s => s.section === '')
  const dashboardLink = mainSection?.links.find(l => l.label === 'Dashboard')

  return (
    <>
      {/* Mobile backdrop */}
      {sidebarOpen && (
        <div
          className="backdrop"
          style={{ zIndex: 'var(--z-drawer)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={cn('sidebar', sidebarOpen && 'open')} style={{ zIndex: 'var(--z-drawer)' }}>
        {/* Logo */}
        <div className="sidebar-logo">
          {school?.schoolLogo ? (
            <div className="logo-icon" style={{ overflow: 'hidden', borderRadius: '4px' }}>
              <Image
                src={school.schoolLogo}
                alt={school.schoolName}
                width={20}
                height={20}
                style={{ width: '100%', height: '100%', objectFit: 'contain' }}
              />
            </div>
          ) : (
            <div className="logo-icon">
              <Video size={20} color="#fff" />
            </div>
          )}
          <span className="logo-text" title={school?.schoolName ?? 'ClassMeet'}>{school?.schoolName ?? 'ClassMeet'}</span>

          {/* Mobile close */}
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginLeft: 'auto', display: 'none' }}
            id="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dashboard link at top */}
        {dashboardLink && (
          <div style={{ padding: '8px 4px 0' }}>
            <Link
              href={dashboardLink.href}
              className={cn('sidebar-link', pathname === dashboardLink.href && 'active')}
              onClick={() => setSidebarOpen(false)}
            >
              <LayoutDashboard size={17} className="link-icon" />
              Dashboard
            </Link>
          </div>
        )}

        {/* People section — more space now that nav moved to header */}
        {user?.id && (
          <div style={{ paddingTop: '8px', paddingBottom: '8px', overflowY: 'auto', flex: 1, borderBottom: '1px solid var(--border-subtle)' }}>
            {role === 'admin' ? (
              <AdminOverview />
            ) : isCreator ? (
              <StudentList teacherId={user.id} />
            ) : (
              <TeacherInfo studentId={user.id} />
            )}
          </div>
        )}

        {/* System section — pinned to bottom */}
        {systemSection && (
          <nav aria-label="System navigation" style={{ padding: '4px 0', borderTop: '1px solid var(--border-subtle)' }}>
            <div className="sidebar-section" style={{ marginBottom: 0, padding: '8px 0 4px' }}>
              <div className="sidebar-section-label">{systemSection.section}</div>
              {systemSection.links
                .filter(link => {
                  if (link.roles && !(role && link.roles.includes(role))) return false
                  if (link.permissionCheck && !link.permissionCheck(permissions)) return false
                  return true
                })
                .map(link => {
                  const Icon = link.icon
                  const isActive = pathname === link.href || pathname.startsWith(link.href + '/')
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      className={cn('sidebar-link', isActive && 'active')}
                      onClick={() => setSidebarOpen(false)}
                    >
                      <Icon size={17} className="link-icon" />
                      {link.label}
                    </Link>
                  )
                })}
            </div>
          </nav>
        )}

        {/* Footer */}
        <div className="sidebar-footer">
          <p style={{ fontSize: '0.72rem', color: 'var(--text-disabled)', textAlign: 'center' }}>
            ClassMeet v1.0 · All rights reserved
          </p>
        </div>
      </aside>
    </>
  )
}
