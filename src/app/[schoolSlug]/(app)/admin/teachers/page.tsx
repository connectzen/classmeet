'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Users, Plus, Trash2, X, Eye, EyeOff, ArrowLeft, Search, Shield, Check, ChevronDown, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import type { TeacherPermissionKey } from '@/lib/supabase/types'

const PERMISSION_LABELS: Record<TeacherPermissionKey, string> = {
  invite_students: 'Invite Students',
  invite_teachers: 'Invite Teachers',
  create_groups: 'Create Groups',
  create_courses: 'Create Courses',
  create_sessions: 'Create Sessions',
  manage_quizzes: 'Manage Quizzes',
  manage_settings: 'Manage Settings',
}

interface Teacher {
  id: string
  full_name: string | null
  role: string
  created_at: string
  email?: string
}

export default function AdminTeachersPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [teacherPerms, setTeacherPerms] = useState<Map<string, TeacherPermissionKey[]>>(new Map())
  const [savingPerm, setSavingPerm] = useState(false)

  // Form state
  const [formName, setFormName] = useState('')
  const [formEmail, setFormEmail] = useState('')
  const [formPassword, setFormPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  const showAlert = useCallback((type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }, [])

  const loadTeachers = useCallback(async () => {
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/teachers`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load teachers')

      // Fetch emails via admin client on server — for now use auth metadata
      // The profiles table doesn't store email, so we'll fetch from supabase auth
      // But client can't access auth.users. We'll just show what we have.
      setTeachers(json.data || [])
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to load teachers')
    } finally {
      setLoading(false)
    }
  }, [school.schoolId, showAlert])

  // Load default password for pre-fill
  const [defaultPassword, setDefaultPassword] = useState('')
  useEffect(() => {
    async function loadDefaults() {
      const supabase = createClient()
      const { data } = await supabase
        .from('schools')
        .select('default_teacher_password')
        .eq('id', school.schoolId)
        .single()
      if (data) {
        setDefaultPassword(data.default_teacher_password)
        setFormPassword(data.default_teacher_password)
      }
    }
    loadDefaults()
  }, [school.schoolId])

  useEffect(() => {
    loadTeachers()
  }, [loadTeachers])

  // Load permissions for a teacher when expanded
  const loadPerms = useCallback(async (teacherId: string) => {
    const supabase = createClient()
    const { data } = await supabase
      .from('teacher_permissions')
      .select('permission')
      .eq('teacher_id', teacherId)
    setTeacherPerms(prev => new Map(prev).set(teacherId, (data ?? []).map((p: any) => p.permission)))
  }, [])

  async function togglePerm(teacherId: string, perm: TeacherPermissionKey, has: boolean) {
    if (!user?.id) return
    setSavingPerm(true)
    const supabase = createClient()
    if (has) {
      await supabase.from('teacher_permissions').delete().eq('teacher_id', teacherId).eq('permission', perm)
    } else {
      await supabase.from('teacher_permissions').insert({ teacher_id: teacherId, granted_by: user.id, permission: perm })
    }
    setTeacherPerms(prev => {
      const map = new Map(prev)
      const current = map.get(teacherId) ?? []
      map.set(teacherId, has ? current.filter(p => p !== perm) : [...current, perm])
      return map
    })
    setSavingPerm(false)
  }

  async function grantAllPerms(teacherId: string) {
    if (!user?.id) return
    setSavingPerm(true)
    const supabase = createClient()
    await supabase.from('teacher_permissions').upsert(
      ALL_PERMISSIONS.map(p => ({ teacher_id: teacherId, granted_by: user.id, permission: p })),
      { onConflict: 'teacher_id,permission' }
    )
    setTeacherPerms(prev => new Map(prev).set(teacherId, [...ALL_PERMISSIONS]))
    setSavingPerm(false)
  }

  async function revokeAllPerms(teacherId: string) {
    setSavingPerm(true)
    const supabase = createClient()
    await supabase.from('teacher_permissions').delete().eq('teacher_id', teacherId)
    setTeacherPerms(prev => new Map(prev).set(teacherId, []))
    setSavingPerm(false)
  }

  const handleSubmit = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      showAlert('error', 'Name and email are required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/teachers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formName.trim(),
          email: formEmail.trim(),
          password: formPassword || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add teacher')

      setTeachers((prev) => [json.data, ...prev])
      setFormName('')
      setFormEmail('')
      setFormPassword(defaultPassword)
      setShowForm(false)
      showAlert('success', 'Teacher added successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to add teacher')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (teacherId: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/teachers/${teacherId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete teacher')

      setTeachers((prev) => prev.filter((t) => t.id !== teacherId))
      setDeleteId(null)
      showAlert('success', 'Teacher removed successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to delete teacher')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = teachers.filter((t) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (t.full_name || '').toLowerCase().includes(q)
  })

  return (
    <div style={{ padding: '24px', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Alert */}
      {alert && (
        <div
          style={{
            position: 'fixed',
            top: 20,
            right: 20,
            zIndex: 1000,
            padding: '12px 20px',
            borderRadius: '8px',
            fontSize: '0.875rem',
            fontWeight: 500,
            color: '#fff',
            background: alert.type === 'success' ? 'var(--success-500, #22c55e)' : 'var(--error-500, #ef4444)',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          {alert.message}
          <button onClick={() => setAlert(null)} style={{ background: 'none', border: 'none', color: '#fff', cursor: 'pointer', padding: 0 }}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
        <Link href={`/${school.schoolSlug}/admin`} style={{ color: 'var(--text-muted)', display: 'flex' }}>
          <ArrowLeft size={20} />
        </Link>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={24} color="var(--primary-500)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Teachers
          </h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24, paddingLeft: 32 }}>
        Manage teachers for {school.schoolName}
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            placeholder="Search teachers..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            leftIcon={<Search size={16} />}
          />
        </div>
        <Button
          icon={<Plus size={16} />}
          onClick={() => setShowForm(!showForm)}
          variant={showForm ? 'outline' : 'primary'}
        >
          {showForm ? 'Cancel' : 'Add Teacher'}
        </Button>
      </div>

      {/* Add Teacher Form */}
      {showForm && (
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 12,
            padding: 24,
            marginBottom: 24,
          }}
        >
          <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 16 }}>
            Add New Teacher
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Input
              label="Full Name"
              placeholder="e.g. John Smith"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="e.g. john@school.com"
              value={formEmail}
              onChange={(e) => setFormEmail(e.target.value)}
              required
            />
            <Input
              label="Password"
              type={showPassword ? 'text' : 'password'}
              placeholder="Leave blank for default"
              value={formPassword}
              onChange={(e) => setFormPassword(e.target.value)}
              rightIcon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightIconClick={() => setShowPassword(!showPassword)}
            />
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 8, marginBottom: 16 }}>
            Default password: {defaultPassword || 'Teacher@123'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={handleSubmit} loading={submitting}>
              Add Teacher
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Teachers Table */}
      <div
        style={{
          background: 'var(--card-bg)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        {/* Table Header */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr auto',
            padding: '12px 20px',
            background: 'var(--bg-secondary, var(--card-bg))',
            borderBottom: '1px solid var(--border-subtle)',
            fontSize: '0.75rem',
            fontWeight: 600,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}
        >
          <span>Name</span>
          <span>Joined</span>
          <span>Actions</span>
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading teachers...
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {search ? 'No teachers match your search.' : 'No teachers added yet. Click "Add Teacher" to get started.'}
          </div>
        )}

        {/* Rows */}
        {filtered.map((teacher) => (
          <div key={teacher.id}>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                padding: '14px 20px',
                borderBottom: '1px solid var(--border-subtle)',
                alignItems: 'center',
                fontSize: '0.875rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => {
                    const next = expandedTeacher === teacher.id ? null : teacher.id
                    setExpandedTeacher(next)
                    if (next && !teacherPerms.has(teacher.id)) loadPerms(teacher.id)
                  }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', color: 'var(--text-muted)' }}
                >
                  {expandedTeacher === teacher.id ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </button>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {teacher.full_name || 'Unnamed'}
                  </div>
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {new Date(teacher.created_at).toLocaleDateString()}
              </div>
              <div>
                {deleteId === teacher.id ? (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm?</span>
                    <Button
                      size="sm"
                      variant="danger"
                      onClick={() => handleDelete(teacher.id)}
                      loading={deleting}
                    >
                      Delete
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)}>
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={<Trash2 size={14} />}
                    onClick={() => setDeleteId(teacher.id)}
                    style={{ color: 'var(--error-500, #ef4444)' }}
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>

            {/* Expandable permissions section */}
            {expandedTeacher === teacher.id && (
              <div style={{ padding: '16px 20px 16px 44px', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary, rgba(0,0,0,0.02))' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                    <Shield size={14} /> Permissions
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Button variant="outline" size="sm" onClick={() => grantAllPerms(teacher.id)} disabled={savingPerm}>Grant All</Button>
                    <Button variant="ghost" size="sm" onClick={() => revokeAllPerms(teacher.id)} disabled={savingPerm}>Revoke All</Button>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 6 }}>
                  {ALL_PERMISSIONS.map(perm => {
                    const has = (teacherPerms.get(teacher.id) ?? []).includes(perm)
                    return (
                      <button
                        key={perm}
                        onClick={() => togglePerm(teacher.id, perm, has)}
                        disabled={savingPerm}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          padding: '8px 10px', borderRadius: 6,
                          border: `1px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                          background: has ? 'rgba(99,102,241,0.08)' : 'transparent',
                          cursor: 'pointer', fontSize: '0.78rem', fontWeight: 500,
                          color: has ? 'var(--primary-500)' : 'var(--text-muted)',
                          textAlign: 'left',
                        }}
                      >
                        <div style={{
                          width: 16, height: 16, borderRadius: 3,
                          border: `2px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                          background: has ? 'var(--primary-500)' : 'transparent',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          flexShrink: 0,
                        }}>
                          {has && <Check size={10} color="#fff" />}
                        </div>
                        {PERMISSION_LABELS[perm]}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'right' }}>
          {filtered.length} teacher{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ' total'}
        </p>
      )}
    </div>
  )
}
