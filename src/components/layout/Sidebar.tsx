'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { usePresenceStore } from '@/store/presence-store'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import Avatar from '@/components/ui/Avatar'
import { Video, Settings, ShieldCheck, X, Circle } from 'lucide-react'
import { cn } from '@/lib/utils'

type NavLink = { href: string; label: string; icon: React.ElementType; roles?: UserRole[]; badgeKey?: string }
type NavSection = { section: string; links: NavLink[] }

const NAV: NavSection[] = [
  {
    section: 'System',
    links: [
      { href: '/dashboard/settings', label: 'Settings',   icon: Settings                            },
      { href: '/admin',              label: 'Admin Panel', icon: ShieldCheck, roles: ['admin']       },
    ],
  },
]

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
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px', opacity: isOnline ? 1 : 0.7 }}>
      <Avatar src={p.avatar_url} name={p.full_name} size="xs" online={isOnline} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '0.8rem', color: isOnline ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: isOnline ? 500 : 400, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {p.full_name || fallbackName}
        </div>
        <div style={{ fontSize: '0.65rem', color: isOnline ? 'var(--success-400)' : 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: '4px' }}>
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
      const { data: enrollments } = await supabase
        .from('teacher_students')
        .select('student_id')
        .eq('teacher_id', teacherId)

      if (enrollments && enrollments.length > 0) {
        const ids = enrollments.map(e => e.student_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, last_seen, role')
          .in('id', ids)

        if (profiles) setContacts(profiles as (SidebarPerson & { role: string })[])
      } else {
        setContacts([])
      }
    }

    load()

    const enrollChannel = supabase
      .channel('sidebar-enrollments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students', filter: `teacher_id=eq.${teacherId}` }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(enrollChannel) }
  }, [teacherId])

  const students = contacts.filter(c => c.role !== 'teacher')
  const collabs  = contacts.filter(c => c.role === 'teacher')

  return (
    <>
      {/* Collaboration teachers */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">Collaboration</div>
        {collabs.length === 0
          ? <p style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', padding: '4px 16px' }}>No co-teachers yet</p>
          : collabs.map(c => <PersonRow key={c.id} p={c} fallbackName="Teacher" isOnline={onlineUsers.has(c.id)} />)
        }
      </div>

      {/* Students */}
      <div className="sidebar-section">
        <div className="sidebar-section-label">{students.length > 0 ? `Students — ${students.length}` : 'Students'}</div>
        {students.length === 0
          ? <p style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', padding: '4px 16px' }}>No students yet</p>
          : students.map(s => <PersonRow key={s.id} p={s} fallbackName="Student" isOnline={onlineUsers.has(s.id)} />)
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

    const channel = supabase
      .channel('sidebar-teacher')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students', filter: `student_id=eq.${studentId}` }, () => loadTeachers())
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [studentId])

  if (teachers.length === 0) {
    return (
      <div className="sidebar-section">
        <div className="sidebar-section-label">My Teachers</div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-disabled)', padding: '4px 16px' }}>No teacher assigned</p>
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

export default function Sidebar() {
  const pathname = usePathname()
  const { sidebarOpen, setSidebarOpen, user } = useAppStore()
  const role = user?.role as UserRole | undefined
  const isCreator = role === 'teacher' || role === 'admin'

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
          <div className="logo-icon">
            <Video size={20} color="#fff" />
          </div>
          <span className="logo-text">ClassMeet</span>

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

        {/* People section — teacher sees students, student sees teacher */}
        {user?.id && (
          <div style={{ paddingTop: '10px', overflowY: 'auto', flex: '0 1 auto', maxHeight: '40vh' }}>
            {isCreator ? (
              <StudentList teacherId={user.id} />
            ) : (
              <TeacherInfo studentId={user.id} />
            )}
          </div>
        )}

        {/* Spacer pushes system nav + footer to bottom */}
        <div style={{ flex: 1 }} />

        {/* Navigation — pinned to bottom */}
        <nav aria-label="System navigation" style={{ padding: '4px 0', borderTop: '1px solid var(--border-subtle)' }}>
          {NAV.map((section) => {
            const visibleLinks = section.links.filter(
              (link) => !link.roles || (role && link.roles.includes(role))
            )
            if (visibleLinks.length === 0) return null
            return (
              <div key={section.section} className="sidebar-section" style={{ marginBottom: 0, padding: '8px 0 4px' }}>
                <div className="sidebar-section-label">{section.section}</div>
                {visibleLinks.map((link) => {
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
            )
          })}
        </nav>

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

