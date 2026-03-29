'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Search, ChevronDown, ChevronRight, Building2, Shield,
  GraduationCap, BookOpen, Users, Plus, Crown,
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
      <div style={{ width: 18, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {expandable ? (
          expanded ? <ChevronDown size={16} style={{ color: 'var(--text-muted)' }} />
            : <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
        ) : (
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: roleColor(user.role, user.is_super_admin), opacity: 0.6 }} />
        )}
      </div>

      <Avatar src={user.avatar_url} name={user.full_name} size="sm" />

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {user.full_name || 'Unnamed'}
          </span>
          <Badge role={user.is_super_admin ? 'super_admin' : user.role as any} />
        </div>
      </div>

      {expandable && childCount !== undefined && childCount > 0 && (
        <span style={{
          fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px',
          borderRadius: '9999px', background: 'var(--bg-tertiary)',
          color: 'var(--text-muted)', letterSpacing: '0.02em',
        }}>
          {childCount}
        </span>
      )}

      <span style={{ fontSize: '0.78rem', color: user.onboarding_complete ? 'var(--success-400)' : 'var(--warning-400)', flexShrink: 0 }}>
        {user.onboarding_complete ? '✓ Active' : '⏳ Pending'}
      </span>
    </div>
  )
}

// ── School Card ───────────────────────────────────────────────────────────────
function SchoolCard({ school, searchFilter }: { school: SchoolNode; searchFilter: string }) {
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
  const schoolNameMatches = !searchFilter || school.name.toLowerCase().includes(searchFilter) || school.slug.toLowerCase().includes(searchFilter)

  if (searchFilter && !schoolNameMatches && !adminMatches && filteredTeachers.length === 0 && filteredUnlinked.length === 0) {
    return null
  }

  const isExpanded = searchFilter ? true : expanded
  const totalStudents = school.unlinkedStudents.length + school.teachers.reduce((s, t) => s + t.students.length, 0)

  function toggleTeacher(id: string) {
    setExpandedTeachers(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  return (
    <div className="card" style={{ overflow: 'hidden', marginBottom: '16px' }}>
      {/* School header — same as Users page */}
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
            {totalStudents} student{totalStudents !== 1 ? 's' : ''}
          </span>
          <Link
            href={`/superadmin/schools/${school.id}`}
            onClick={e => e.stopPropagation()}
            style={{
              fontSize: '0.7rem', padding: '3px 10px', borderRadius: '9999px',
              background: 'rgba(59,130,246,0.1)', color: '#3b82f6', fontWeight: 600,
              textDecoration: 'none', display: 'flex', alignItems: 'center',
            }}
          >
            Edit
          </Link>
        </div>
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <div>
          {school.admin && adminMatches && (
            <UserRow user={school.admin} indent={1} />
          )}

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
export default function SchoolsPage() {
  const [schools, setSchools] = useState<SchoolNode[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetch('/api/superadmin/users/hierarchy')
      .then(r => r.json())
      .then(r => setSchools(r.data?.schools || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const searchLower = search.toLowerCase().trim()

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>Schools</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
            {schools.length} school{schools.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Link href="/superadmin/schools/create">
          <button className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Plus size={18} />
            New School
          </button>
        </Link>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', position: 'relative', maxWidth: '400px' }}>
        <input
          className="input"
          type="text"
          placeholder="Search by name or slug…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ paddingLeft: '38px' }}
        />
        <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
      </div>

      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading schools…</div>
        </div>
      ) : schools.length === 0 ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No schools yet. Create one to get started.</p>
        </div>
      ) : (
        <div>
          {schools.map(school => (
            <SchoolCard key={school.id} school={school} searchFilter={searchLower} />
          ))}
        </div>
      )}
    </div>
  )
}
