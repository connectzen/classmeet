'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, ChevronDown, ChevronRight, Building2, Shield,
  GraduationCap, BookOpen, Users, UserX, Crown,
} from 'lucide-react'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Profile {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  is_super_admin: boolean
  onboarding_complete: boolean
  created_at: string
}

interface TeacherNode extends Profile {
  students: Profile[]
}

interface SchoolNode {
  id: string
  name: string
  slug: string
  admin_id: string
  created_at: string
  admin: Profile | null
  teachers: TeacherNode[]
  unlinkedStudents: Profile[]
  totalMembers: number
}

interface HierarchyData {
  schools: SchoolNode[]
  unaffiliated: Profile[]
  superAdmins: Profile[]
  totals: { schools: number; users: number }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function roleColor(role: string, isSuperAdmin?: boolean): string {
  if (isSuperAdmin) return '#8b5cf6'
  switch (role) {
    case 'admin': return '#3b82f6'
    case 'teacher': return '#10b981'
    case 'student': return '#f59e0b'
    default: return '#6b7280'
  }
}

function roleIcon(role: string, isSuperAdmin?: boolean) {
  if (isSuperAdmin) return <Crown size={14} />
  switch (role) {
    case 'admin': return <Shield size={14} />
    case 'teacher': return <BookOpen size={14} />
    case 'student': return <GraduationCap size={14} />
    default: return <Users size={14} />
  }
}

// ── User Row ──────────────────────────────────────────────────────────────────
function UserRow({ user, indent = 0, expandable, expanded, onToggle, childCount }: {
  user: Profile
  indent?: number
  expandable?: boolean
  expanded?: boolean
  onToggle?: () => void
  childCount?: number
}) {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: '12px',
        padding: '10px 16px', paddingLeft: `${16 + indent * 28}px`,
        borderBottom: '1px solid var(--border-subtle)',
        transition: 'background var(--transition-fast)',
        cursor: expandable ? 'pointer' : 'default',
      }}
      onClick={expandable ? onToggle : undefined}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = '' }}
    >
      {/* Expand toggle or spacer */}
      <div style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {expandable ? (
          expanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor(user.role, user.is_super_admin), opacity: 0.6 }} />
        )}
      </div>

      {/* Avatar */}
      <Avatar src={user.avatar_url} name={user.full_name} size="sm" />

      {/* Name + role */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Link
            href={`/superadmin/users/${user.id}`}
            style={{
              fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
              textDecoration: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}
            onClick={e => e.stopPropagation()}
          >
            {user.full_name || 'Unnamed'}
          </Link>
          <Badge role={user.is_super_admin ? 'super_admin' : user.role as any} />
        </div>
      </div>

      {/* Count badge for expandable rows */}
      {expandable && childCount !== undefined && childCount > 0 && (
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
          borderRadius: '9999px', background: 'var(--bg-tertiary)',
          color: 'var(--text-muted)', letterSpacing: '0.02em',
        }}>
          {childCount}
        </span>
      )}

      {/* Status */}
      <span style={{ fontSize: '0.78rem', color: user.onboarding_complete ? 'var(--success-400)' : 'var(--warning-400)', flexShrink: 0 }}>
        {user.onboarding_complete ? '✓ Active' : '⏳ Pending'}
      </span>
    </div>
  )
}

// ── School Section ────────────────────────────────────────────────────────────
function SchoolSection({ school, searchFilter }: { school: SchoolNode; searchFilter: string }) {
  const [expanded, setExpanded] = useState(false)
  const [expandedTeachers, setExpandedTeachers] = useState<Set<string>>(new Set())

  const matchesSearch = (p: Profile | null) => {
    if (!searchFilter || !p) return true
    return p.full_name?.toLowerCase().includes(searchFilter) || p.id.includes(searchFilter)
  }

  const filteredTeachers = school.teachers.filter(t =>
    matchesSearch(t) || t.students.some(s => matchesSearch(s))
  )
  const filteredUnlinked = school.unlinkedStudents.filter(matchesSearch)
  const adminMatches = matchesSearch(school.admin)

  // If search is active and nothing matches, hide this school
  if (searchFilter && !adminMatches && filteredTeachers.length === 0 && filteredUnlinked.length === 0) {
    return null
  }

  // Auto-expand when searching
  const isExpanded = searchFilter ? true : expanded

  function toggleTeacher(id: string) {
    setExpandedTeachers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: '16px' }}>
      {/* School header */}
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: '12px',
          padding: '14px 16px', cursor: 'pointer',
          background: 'var(--bg-elevated)',
          borderBottom: isExpanded ? '1px solid var(--border-subtle)' : 'none',
        }}
        onClick={() => setExpanded(e => !e)}
      >
        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        <div style={{
          width: 36, height: 36, borderRadius: 'var(--radius-md)',
          background: 'rgba(59,130,246,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Building2 size={18} style={{ color: '#3b82f6' }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {school.name}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            /{school.slug} · {school.totalMembers} member{school.totalMembers !== 1 ? 's' : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '9999px', background: 'rgba(16,185,129,0.1)', color: '#10b981', fontWeight: 600 }}>
            {school.teachers.length} teacher{school.teachers.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: '0.7rem', padding: '3px 8px', borderRadius: '9999px', background: 'rgba(245,158,11,0.1)', color: '#f59e0b', fontWeight: 600 }}>
            {school.unlinkedStudents.length + school.teachers.reduce((s, t) => s + t.students.length, 0)} student{school.unlinkedStudents.length + school.teachers.reduce((s, t) => s + t.students.length, 0) !== 1 ? 's' : ''}
          </span>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {/* Admin */}
          {school.admin && adminMatches && (
            <UserRow user={school.admin} indent={1} />
          )}

          {/* Teachers → Students */}
          {filteredTeachers.map(teacher => {
            const teacherExpanded = searchFilter ? true : expandedTeachers.has(teacher.id)
            const filteredStudents = teacher.students.filter(matchesSearch)
            return (
              <div key={teacher.id}>
                <UserRow
                  user={teacher}
                  indent={1}
                  expandable={teacher.students.length > 0}
                  expanded={teacherExpanded}
                  onToggle={() => toggleTeacher(teacher.id)}
                  childCount={teacher.students.length}
                />
                {teacherExpanded && filteredStudents.map(student => (
                  <UserRow key={student.id} user={student} indent={2} />
                ))}
              </div>
            )
          })}

          {/* Unlinked students */}
          {filteredUnlinked.length > 0 && (
            <>
              <div style={{
                padding: '8px 16px 8px 72px', fontSize: '0.72rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-disabled)',
                borderTop: '1px solid var(--border-subtle)',
              }}>
                Unassigned students
              </div>
              {filteredUnlinked.map(s => (
                <UserRow key={s.id} user={s} indent={2} />
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function UsersPage() {
  const [data, setData] = useState<HierarchyData | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/superadmin/users/hierarchy')
      .then(r => r.json())
      .then(r => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const searchLower = search.toLowerCase().trim()

  const matchesSearch = (p: Profile | null) => {
    if (!searchLower || !p) return true
    return p.full_name?.toLowerCase().includes(searchLower) || p.id.includes(searchLower)
  }

  const filteredSuperAdmins = data?.superAdmins.filter(matchesSearch) || []
  const filteredUnaffiliated = data?.unaffiliated.filter(matchesSearch) || []

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Users & Schools
          </h1>
          {data && (
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
              {data.totals.users} users across {data.totals.schools} school{data.totals.schools !== 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '400px' }}>
        <input
          className="input"
          type="text"
          placeholder="Search by name or ID…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '38px' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading users…</div>
        </div>
      ) : !data ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)' }}>Failed to load user data.</div>
        </div>
      ) : (
        <>
          {/* Super Admins */}
          {filteredSuperAdmins.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{
                margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Crown size={14} /> Super Admins
              </h3>
              <div className="card" style={{ overflow: 'hidden' }}>
                {filteredSuperAdmins.map(sa => (
                  <UserRow key={sa.id} user={sa} />
                ))}
              </div>
            </div>
          )}

          {/* Schools hierarchy */}
          {data.schools.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{
                margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <Building2 size={14} /> Schools
              </h3>
              {data.schools.map(school => (
                <SchoolSection key={school.id} school={school} searchFilter={searchLower} />
              ))}
            </div>
          )}

          {/* Unaffiliated users */}
          {filteredUnaffiliated.length > 0 && (
            <div style={{ marginBottom: '16px' }}>
              <h3 style={{
                margin: '0 0 10px', fontSize: '0.78rem', fontWeight: 600,
                textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                <UserX size={14} /> Unaffiliated Users
              </h3>
              <div className="card" style={{ overflow: 'hidden' }}>
                {filteredUnaffiliated.map(u => (
                  <UserRow key={u.id} user={u} />
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
