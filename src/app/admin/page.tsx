'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import type { UserRole } from '@/lib/supabase/types'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  Shield, Users, BookOpen, ArrowLeft, Search, Trash2,
  UserCheck, GraduationCap, ChevronDown, ChevronRight,
  RefreshCw, Home,
} from 'lucide-react'

interface AdminUser {
  id: string
  email?: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole
  onboarding_complete: boolean
  created_at: string
  last_seen: string | null
}

interface AdminCourse {
  id: string
  title: string
  subject: string
  published: boolean
  teacher_id: string
  created_at: string
}

interface AdminGroup {
  id: string
  name: string
  teacher_id: string
  created_at: string
}

type Tab = 'users' | 'courses' | 'groups'

export default function AdminPage() {
  const router = useRouter()
  const currentUser = useAppStore(s => s.user)
  const supabase = createClient()

  const [tab, setTab] = useState<Tab>('users')
  const [users, setUsers] = useState<AdminUser[]>([])
  const [courses, setCourses] = useState<AdminCourse[]>([])
  const [groups, setGroups] = useState<AdminGroup[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    const [usersRes, coursesRes, groupsRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase.rpc as any)('admin_get_users') as Promise<{ data: AdminUser[] | null }>,
      supabase.from('courses').select('*').order('created_at', { ascending: false }),
      supabase.from('groups').select('*').order('created_at', { ascending: false }),
    ])
    if (usersRes.data) setUsers(usersRes.data)
    if (coursesRes.data) setCourses(coursesRes.data as AdminCourse[])
    if (groupsRes.data) setGroups(groupsRes.data as AdminGroup[])
    setLoading(false)
  }, [supabase])

  useEffect(() => { loadData() }, [loadData])

  // Guard: redirect non-admins
  useEffect(() => {
    if (currentUser && currentUser.role !== 'admin') {
      router.push('/dashboard')
    }
  }, [currentUser, router])

  const filteredUsers = users.filter(u =>
    u.full_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.role?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredCourses = courses.filter(c =>
    c.title?.toLowerCase().includes(search.toLowerCase()) ||
    c.subject?.toLowerCase().includes(search.toLowerCase())
  )

  const filteredGroups = groups.filter(g =>
    g.name?.toLowerCase().includes(search.toLowerCase())
  )

  async function changeRole(userId: string, newRole: UserRole) {
    await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
    setUsers(prev => prev.map(u => u.id === userId ? { ...u, role: newRole } : u))
  }

  async function deleteUser(userId: string) {
    if (userId === currentUser?.id) return
    if (!confirm('Delete this user and all their data? This cannot be undone.')) return
    await supabase.from('profiles').delete().eq('id', userId)
    setUsers(prev => prev.filter(u => u.id !== userId))
  }

  async function deleteCourse(courseId: string) {
    if (!confirm('Delete this course?')) return
    await supabase.from('courses').delete().eq('id', courseId)
    setCourses(prev => prev.filter(c => c.id !== courseId))
  }

  async function deleteGroup(groupId: string) {
    if (!confirm('Delete this group?')) return
    await supabase.from('groups').delete().eq('id', groupId)
    setGroups(prev => prev.filter(g => g.id !== groupId))
  }

  const cardStyle: React.CSSProperties = {
    background: 'var(--bg-card)', border: '1px solid var(--border-default)',
    borderRadius: 'var(--radius-lg)', padding: '20px',
  }

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 'var(--radius-md)', border: 'none', cursor: 'pointer',
    fontWeight: 600, fontSize: '0.85rem', transition: 'all 0.15s',
    background: active ? 'var(--primary-500)' : 'var(--bg-elevated)',
    color: active ? '#fff' : 'var(--text-secondary)',
  })

  const thStyle: React.CSSProperties = {
    padding: '10px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600,
    color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em',
    borderBottom: '1px solid var(--border-default)',
  }

  const tdStyle: React.CSSProperties = {
    padding: '12px 14px', fontSize: '0.85rem', color: 'var(--text-primary)',
    borderBottom: '1px solid var(--border-subtle)',
  }

  const roleBadge = (role: string) => {
    const colors: Record<string, string> = {
      admin: 'rgba(239,68,68,0.15)', teacher: 'rgba(59,130,246,0.15)',
      student: 'rgba(34,197,94,0.15)', member: 'rgba(168,85,247,0.15)', guest: 'rgba(156,163,175,0.15)',
    }
    const textColors: Record<string, string> = {
      admin: '#ef4444', teacher: '#3b82f6', student: '#22c55e', member: '#a855f7', guest: '#9ca3af',
    }
    return (
      <span style={{
        padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
        background: colors[role] || colors.guest, color: textColors[role] || textColors.guest,
      }}>
        {role}
      </span>
    )
  }

  if (!currentUser || currentUser.role !== 'admin') return null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-primary)', padding: '24px' }}>
      {/* Header */}
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: 'rgba(239,68,68,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Shield size={20} color="#ef4444" />
            </div>
            <div>
              <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Admin Panel</h1>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>Manage users, courses, and groups</p>
            </div>
          </div>
          <Button variant="outline" size="sm" icon={<Home size={14} />} onClick={() => router.push('/dashboard')}>
            Dashboard
          </Button>
        </div>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '24px' }}>
          {[
            { label: 'Total Users', value: users.length, icon: <Users size={18} />, color: '#6366f1' },
            { label: 'Teachers', value: users.filter(u => u.role === 'teacher').length, icon: <GraduationCap size={18} />, color: '#3b82f6' },
            { label: 'Students', value: users.filter(u => u.role === 'student').length, icon: <UserCheck size={18} />, color: '#22c55e' },
            { label: 'Courses', value: courses.length, icon: <BookOpen size={18} />, color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} style={{ ...cardStyle, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '10px', background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
                {stat.icon}
              </div>
              <div>
                <p style={{ fontSize: '1.3rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>{stat.value}</p>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0 }}>{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Tabs + Search */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '6px' }}>
            <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>Users ({users.length})</button>
            <button style={tabStyle(tab === 'courses')} onClick={() => setTab('courses')}>Courses ({courses.length})</button>
            <button style={tabStyle(tab === 'groups')} onClick={() => setTab('groups')}>Groups ({groups.length})</button>
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Input
              placeholder="Search…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              leftIcon={<Search size={14} />}
              style={{ width: 220 }}
            />
            <Button variant="outline" size="sm" icon={<RefreshCw size={14} />} onClick={loadData} loading={loading}>
              Refresh
            </Button>
          </div>
        </div>

        {/* Table */}
        <div style={{ ...cardStyle, padding: 0, overflow: 'auto' }}>
          {tab === 'users' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>User</th>
                  <th style={thStyle}>Email</th>
                  <th style={thStyle}>Role</th>
                  <th style={thStyle}>Joined</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.map(u => (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <Avatar name={u.full_name || u.email} src={u.avatar_url} size="sm" />
                        <span style={{ fontWeight: 500 }}>{u.full_name || '(no name)'}</span>
                      </div>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{u.email}</td>
                    <td style={tdStyle}>{roleBadge(u.role)}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        <select
                          value={u.role}
                          onChange={e => changeRole(u.id, e.target.value as UserRole)}
                          disabled={u.id === currentUser.id}
                          style={{
                            padding: '4px 8px', fontSize: '0.75rem', borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-default)', background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)', cursor: u.id === currentUser.id ? 'not-allowed' : 'pointer',
                          }}
                        >
                          <option value="admin">Admin</option>
                          <option value="teacher">Teacher</option>
                          <option value="student">Student</option>
                          <option value="member">Member</option>
                          <option value="guest">Guest</option>
                        </select>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => deleteUser(u.id)}
                            title="Delete user"
                            style={{
                              width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-sm)',
                              background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {filteredUsers.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No users found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'courses' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Title</th>
                  <th style={thStyle}>Subject</th>
                  <th style={thStyle}>Status</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredCourses.map(c => (
                  <tr key={c.id}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{c.title}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-secondary)' }}>{c.subject}</td>
                    <td style={tdStyle}>
                      <span style={{
                        padding: '3px 10px', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600,
                        background: c.published ? 'rgba(34,197,94,0.15)' : 'rgba(156,163,175,0.15)',
                        color: c.published ? '#22c55e' : '#9ca3af',
                      }}>
                        {c.published ? 'Published' : 'Draft'}
                      </span>
                    </td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(c.created_at).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deleteCourse(c.id)}
                        title="Delete course"
                        style={{
                          width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredCourses.length === 0 && (
                  <tr><td colSpan={5} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No courses found</td></tr>
                )}
              </tbody>
            </table>
          )}

          {tab === 'groups' && (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={thStyle}>Name</th>
                  <th style={thStyle}>Created</th>
                  <th style={thStyle}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredGroups.map(g => (
                  <tr key={g.id}>
                    <td style={{ ...tdStyle, fontWeight: 500 }}>{g.name}</td>
                    <td style={{ ...tdStyle, color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {new Date(g.created_at).toLocaleDateString()}
                    </td>
                    <td style={tdStyle}>
                      <button
                        onClick={() => deleteGroup(g.id)}
                        title="Delete group"
                        style={{
                          width: 28, height: 28, border: 'none', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(239,68,68,0.1)', color: '#ef4444', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredGroups.length === 0 && (
                  <tr><td colSpan={3} style={{ ...tdStyle, textAlign: 'center', color: 'var(--text-muted)' }}>No groups found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
