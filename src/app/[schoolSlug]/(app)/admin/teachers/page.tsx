'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Users, Plus, Trash2, X, Eye, EyeOff, ArrowLeft, Search, Shield, Check, ChevronDown, ChevronRight, BookOpen, GraduationCap, Info, UserPlus, FolderOpen } from 'lucide-react'
import Link from 'next/link'
import { ALL_PERMISSIONS } from '@/lib/permissions'
import type { TeacherPermissionKey } from '@/lib/supabase/types'

type ExpandTab = 'permissions' | 'assignments' | 'students'

const PERMISSION_LABELS: Record<TeacherPermissionKey, string> = {
  invite_members: 'Invite Members',
  create_groups: 'Create Groups',
  create_courses: 'Create Courses',
  create_sessions: 'Create Sessions',
  manage_quizzes: 'Manage Quizzes',
  manage_settings: 'Manage Settings',
}

const PERMISSION_DESCRIPTIONS: Record<TeacherPermissionKey, string> = {
  invite_members: 'Allow this teacher to invite new students and teachers to the school via email or link.',
  create_groups: 'Allow this teacher to create and manage student groups for organized teaching.',
  create_courses: 'Allow this teacher to create courses, add topics, and publish learning materials.',
  create_sessions: 'Allow this teacher to start and schedule live classroom sessions (rooms).',
  manage_quizzes: 'Allow this teacher to create quizzes, exams, and grade student submissions.',
  manage_settings: 'Allow this teacher to access and modify school settings and branding.',
}

interface Teacher {
  id: string
  full_name: string | null
  role: string
  created_at: string
  email?: string
}

interface AssignedClass {
  id: string
  name: string
  description: string | null
  memberCount: number
}

interface AssignedGroup {
  id: string
  name: string
  description: string | null
  memberCount: number
}

interface StudentInfo {
  id: string
  full_name: string | null
  status: 'active' | 'inactive' | 'pending'
  enrolled_at: string
}

export default function AdminTeachersPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')
  const [expandedTeacher, setExpandedTeacher] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<ExpandTab>('permissions')
  const [teacherPerms, setTeacherPerms] = useState<Map<string, TeacherPermissionKey[]>>(new Map())
  const [savingPerm, setSavingPerm] = useState(false)
  const [hoveredPerm, setHoveredPerm] = useState<TeacherPermissionKey | null>(null)

  // Assignments state
  const [teacherClasses, setTeacherClasses] = useState<Map<string, AssignedClass[]>>(new Map())
  const [teacherGroups, setTeacherGroups] = useState<Map<string, AssignedGroup[]>>(new Map())
  const [allClasses, setAllClasses] = useState<{ id: string; name: string }[]>([])
  const [assigningClass, setAssigningClass] = useState(false)
  const [selectedClassId, setSelectedClassId] = useState('')

  // Students state
  const [teacherStudents, setTeacherStudents] = useState<Map<string, StudentInfo[]>>(new Map())
  const [loadingStudents, setLoadingStudents] = useState(false)

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

  // Load classes & groups assigned to a teacher
  const loadAssignments = useCallback(async (teacherId: string) => {
    const supabase = createClient()
    // Classes where teacher_id matches
    const { data: classes } = await supabase
      .from('classes')
      .select('id, name, description')
      .eq('school_id', school.schoolId)
      .eq('teacher_id', teacherId)
    // For each class, get member count
    const classesWithCount: AssignedClass[] = []
    for (const c of classes ?? []) {
      const { count } = await supabase
        .from('class_members')
        .select('id', { count: 'exact', head: true })
        .eq('class_id', c.id)
      classesWithCount.push({ ...c, memberCount: count ?? 0 })
    }
    setTeacherClasses(prev => new Map(prev).set(teacherId, classesWithCount))

    // Groups owned by this teacher in this school
    const { data: groups } = await supabase
      .from('groups')
      .select('id, name, description')
      .eq('school_id', school.schoolId)
      .eq('teacher_id', teacherId)
    const groupsWithCount: AssignedGroup[] = []
    for (const g of groups ?? []) {
      const { count } = await supabase
        .from('group_members')
        .select('id', { count: 'exact', head: true })
        .eq('group_id', g.id)
      groupsWithCount.push({ ...g, memberCount: count ?? 0 })
    }
    setTeacherGroups(prev => new Map(prev).set(teacherId, groupsWithCount))
  }, [school.schoolId])

  // Load all school classes (for the assign dropdown)
  const loadAllClasses = useCallback(async () => {
    const supabase = createClient()
    const { data } = await supabase
      .from('classes')
      .select('id, name, teacher_id')
      .eq('school_id', school.schoolId)
    setAllClasses((data ?? []).map(c => ({ id: c.id, name: c.name })))
  }, [school.schoolId])

  // Assign a class to a teacher
  async function assignClassToTeacher(teacherId: string, classId: string) {
    setAssigningClass(true)
    const supabase = createClient()
    await supabase.from('classes').update({ teacher_id: teacherId }).eq('id', classId)
    await loadAssignments(teacherId)
    setSelectedClassId('')
    setAssigningClass(false)
  }

  // Unassign a class from teacher
  async function unassignClass(teacherId: string, classId: string) {
    const supabase = createClient()
    await supabase.from('classes').update({ teacher_id: null }).eq('id', classId)
    await loadAssignments(teacherId)
  }

  // Load students under a teacher (via teacher_students table)
  const loadStudents = useCallback(async (teacherId: string) => {
    setLoadingStudents(true)
    const supabase = createClient()
    const { data: enrollments } = await supabase
      .from('teacher_students')
      .select('student_id, status, enrolled_at')
      .eq('teacher_id', teacherId)
      .eq('school_id', school.schoolId)

    if (!enrollments || enrollments.length === 0) {
      setTeacherStudents(prev => new Map(prev).set(teacherId, []))
      setLoadingStudents(false)
      return
    }

    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('id', enrollments.map(e => e.student_id))

    const profileMap = new Map((profiles ?? []).map(p => [p.id, p.full_name]))
    const students: StudentInfo[] = enrollments.map(e => ({
      id: e.student_id,
      full_name: profileMap.get(e.student_id) ?? null,
      status: e.status as StudentInfo['status'],
      enrolled_at: e.enrolled_at,
    }))
    setTeacherStudents(prev => new Map(prev).set(teacherId, students))
    setLoadingStudents(false)
  }, [school.schoolId])

  // Handle expanding a teacher row
  function handleExpandTeacher(teacherId: string) {
    const isClosing = expandedTeacher === teacherId
    const next = isClosing ? null : teacherId
    setExpandedTeacher(next)
    if (next) {
      if (!teacherPerms.has(teacherId)) loadPerms(teacherId)
      loadAssignments(teacherId)
      loadAllClasses()
      loadStudents(teacherId)
    }
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
                borderBottom: expandedTeacher === teacher.id ? 'none' : '1px solid var(--border-subtle)',
                alignItems: 'center',
                fontSize: '0.875rem',
                cursor: 'pointer',
                transition: 'background 0.15s',
              }}
              onClick={() => handleExpandTeacher(teacher.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ color: 'var(--text-muted)', display: 'flex', transition: 'transform 0.2s', transform: expandedTeacher === teacher.id ? 'rotate(90deg)' : 'rotate(0deg)' }}>
                  <ChevronRight size={16} />
                </div>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'var(--primary-500)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '0.75rem', fontWeight: 700, flexShrink: 0,
                }}>
                  {(teacher.full_name || 'U').charAt(0).toUpperCase()}
                </div>
                <div>
                  <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                    {teacher.full_name || 'Unnamed'}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>
                    {(teacherPerms.get(teacher.id) ?? []).length} of {ALL_PERMISSIONS.length} permissions
                    {' · '}
                    {(teacherStudents.get(teacher.id) ?? []).length} students
                  </div>
                </div>
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                {new Date(teacher.created_at).toLocaleDateString()}
              </div>
              <div onClick={(e) => e.stopPropagation()}>
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

            {/* Expandable detail section with tabs */}
            {expandedTeacher === teacher.id && (
              <div style={{ borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-secondary, rgba(0,0,0,0.02))' }}>
                {/* Tab bar */}
                <div style={{ display: 'flex', gap: 0, padding: '0 20px', borderBottom: '1px solid var(--border-subtle)' }}>
                  {([
                    { key: 'permissions' as ExpandTab, label: 'Permissions', icon: <Shield size={14} />, count: (teacherPerms.get(teacher.id) ?? []).length },
                    { key: 'assignments' as ExpandTab, label: 'Assignments', icon: <FolderOpen size={14} />, count: (teacherClasses.get(teacher.id) ?? []).length + (teacherGroups.get(teacher.id) ?? []).length },
                    { key: 'students' as ExpandTab, label: 'Students', icon: <GraduationCap size={14} />, count: (teacherStudents.get(teacher.id) ?? []).length },
                  ]).map(tab => (
                    <button
                      key={tab.key}
                      onClick={() => setActiveTab(tab.key)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '10px 16px', fontSize: '0.8rem', fontWeight: 600,
                        color: activeTab === tab.key ? 'var(--primary-500)' : 'var(--text-muted)',
                        background: 'none', border: 'none', cursor: 'pointer',
                        borderBottom: activeTab === tab.key ? '2px solid var(--primary-500)' : '2px solid transparent',
                        marginBottom: -1, transition: 'all 0.15s',
                      }}
                    >
                      {tab.icon}
                      {tab.label}
                      <span style={{
                        background: activeTab === tab.key ? 'var(--primary-500)' : 'var(--border-default)',
                        color: activeTab === tab.key ? '#fff' : 'var(--text-muted)',
                        fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px',
                        borderRadius: 10, minWidth: 18, textAlign: 'center',
                      }}>
                        {tab.count}
                      </span>
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <div style={{ padding: '16px 20px' }}>

                  {/* ── PERMISSIONS TAB ── */}
                  {activeTab === 'permissions' && (
                    <div>
                      {/* Info banner */}
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                        borderRadius: 8, marginBottom: 14, fontSize: '0.78rem', color: 'var(--text-muted)',
                      }}>
                        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>
                          All permissions are <strong style={{ color: 'var(--primary-500)' }}>granted by default</strong> when a teacher joins.
                          Revoke any permission to restrict what this teacher can do. Changes take effect immediately.
                        </span>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          {(teacherPerms.get(teacher.id) ?? []).length} of {ALL_PERMISSIONS.length} enabled
                        </div>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button variant="outline" size="sm" onClick={() => grantAllPerms(teacher.id)} disabled={savingPerm}>
                            Grant All
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => revokeAllPerms(teacher.id)} disabled={savingPerm}>
                            Revoke All
                          </Button>
                        </div>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 8 }}>
                        {ALL_PERMISSIONS.map(perm => {
                          const has = (teacherPerms.get(teacher.id) ?? []).includes(perm)
                          const isHovered = hoveredPerm === perm
                          return (
                            <div key={perm} style={{ position: 'relative' }}>
                              <button
                                onClick={() => togglePerm(teacher.id, perm, has)}
                                onMouseEnter={() => setHoveredPerm(perm)}
                                onMouseLeave={() => setHoveredPerm(null)}
                                disabled={savingPerm}
                                title={PERMISSION_DESCRIPTIONS[perm]}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                                  padding: '10px 12px', borderRadius: 8,
                                  border: `1.5px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                                  background: has ? 'rgba(99,102,241,0.08)' : 'transparent',
                                  cursor: 'pointer', fontSize: '0.8rem', fontWeight: 500,
                                  color: has ? 'var(--primary-500)' : 'var(--text-muted)',
                                  textAlign: 'left', transition: 'all 0.15s',
                                }}
                              >
                                <div style={{
                                  width: 20, height: 20, borderRadius: 4,
                                  border: `2px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                                  background: has ? 'var(--primary-500)' : 'transparent',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  flexShrink: 0, transition: 'all 0.15s',
                                }}>
                                  {has && <Check size={12} color="#fff" />}
                                </div>
                                <div style={{ flex: 1 }}>
                                  <div>{PERMISSION_LABELS[perm]}</div>
                                  <div style={{ fontSize: '0.68rem', fontWeight: 400, color: 'var(--text-tertiary)', marginTop: 2 }}>
                                    {has ? 'Click to revoke' : 'Click to grant'}
                                  </div>
                                </div>
                              </button>

                              {/* Tooltip on hover */}
                              {isHovered && (
                                <div style={{
                                  position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
                                  marginBottom: 6, padding: '8px 12px', borderRadius: 8,
                                  background: 'var(--card-bg, #1e1e2e)', border: '1px solid var(--border-subtle)',
                                  boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
                                  fontSize: '0.75rem', color: 'var(--text-primary)',
                                  width: 240, zIndex: 20, lineHeight: 1.4,
                                  pointerEvents: 'none',
                                }}>
                                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{PERMISSION_LABELS[perm]}</div>
                                  <div style={{ color: 'var(--text-muted)' }}>{PERMISSION_DESCRIPTIONS[perm]}</div>
                                  <div style={{
                                    position: 'absolute', bottom: -5, left: '50%', transform: 'translateX(-50%) rotate(45deg)',
                                    width: 8, height: 8, background: 'var(--card-bg, #1e1e2e)',
                                    borderRight: '1px solid var(--border-subtle)', borderBottom: '1px solid var(--border-subtle)',
                                  }} />
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── ASSIGNMENTS TAB ── */}
                  {activeTab === 'assignments' && (
                    <div>
                      {/* Classes section */}
                      <div style={{ marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                            <BookOpen size={15} />
                            Classes
                          </div>
                        </div>

                        {/* Assign class form */}
                        <div style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
                          <select
                            value={selectedClassId}
                            onChange={(e) => setSelectedClassId(e.target.value)}
                            style={{
                              flex: 1, padding: '8px 12px', borderRadius: 8, fontSize: '0.82rem',
                              background: 'var(--input-bg, var(--card-bg))', color: 'var(--text-primary)',
                              border: '1px solid var(--border-default)', outline: 'none',
                            }}
                          >
                            <option value="">Select a class to assign...</option>
                            {allClasses
                              .filter(c => !(teacherClasses.get(teacher.id) ?? []).some(tc => tc.id === c.id))
                              .map(c => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                              ))}
                          </select>
                          <Button
                            size="sm"
                            onClick={() => selectedClassId && assignClassToTeacher(teacher.id, selectedClassId)}
                            disabled={!selectedClassId || assigningClass}
                            loading={assigningClass}
                          >
                            Assign
                          </Button>
                        </div>

                        {/* Assigned classes list */}
                        {(teacherClasses.get(teacher.id) ?? []).length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem', border: '1px dashed var(--border-default)', borderRadius: 8 }}>
                            No classes assigned. Select a class above to assign it to this teacher.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(teacherClasses.get(teacher.id) ?? []).map(cls => (
                              <div key={cls.id} style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '10px 12px', borderRadius: 8,
                                border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                  <BookOpen size={14} color="var(--primary-500)" />
                                  <div>
                                    <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>{cls.name}</div>
                                    <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{cls.memberCount} student{cls.memberCount !== 1 ? 's' : ''}</div>
                                  </div>
                                </div>
                                <button
                                  onClick={() => unassignClass(teacher.id, cls.id)}
                                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: 4, display: 'flex', borderRadius: 4 }}
                                  title="Unassign class"
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Groups section */}
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10, fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <FolderOpen size={15} />
                          Groups
                        </div>

                        {(teacherGroups.get(teacher.id) ?? []).length === 0 ? (
                          <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.8rem', border: '1px dashed var(--border-default)', borderRadius: 8 }}>
                            This teacher hasn&apos;t created any groups yet. Groups are created by teachers with the &quot;Create Groups&quot; permission.
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            {(teacherGroups.get(teacher.id) ?? []).map(grp => (
                              <div key={grp.id} style={{
                                display: 'flex', alignItems: 'center', padding: '10px 12px',
                                borderRadius: 8, border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                                gap: 8,
                              }}>
                                <FolderOpen size={14} color="var(--secondary-500, #818cf8)" />
                                <div>
                                  <div style={{ fontSize: '0.82rem', fontWeight: 500, color: 'var(--text-primary)' }}>{grp.name}</div>
                                  <div style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)' }}>{grp.memberCount} member{grp.memberCount !== 1 ? 's' : ''}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* ── STUDENTS TAB ── */}
                  {activeTab === 'students' && (
                    <div>
                      <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px',
                        background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)',
                        borderRadius: 8, marginBottom: 14, fontSize: '0.78rem', color: 'var(--text-muted)',
                      }}>
                        <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        <span>Students enrolled under this teacher via the teacher-student enrollment system. These are students this teacher can manage, create sessions for, and assign to groups.</span>
                      </div>

                      {loadingStudents ? (
                        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>Loading students...</div>
                      ) : (teacherStudents.get(teacher.id) ?? []).length === 0 ? (
                        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-tertiary)', fontSize: '0.82rem', border: '1px dashed var(--border-default)', borderRadius: 8 }}>
                          <GraduationCap size={24} style={{ margin: '0 auto 8px', opacity: 0.4 }} />
                          <div>No students enrolled under this teacher yet.</div>
                          <div style={{ fontSize: '0.72rem', marginTop: 4 }}>Students are enrolled when they join via invite link or are assigned by the school admin.</div>
                        </div>
                      ) : (
                        <div>
                          {/* Student count summary */}
                          <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
                            {(['active', 'pending', 'inactive'] as const).map(status => {
                              const count = (teacherStudents.get(teacher.id) ?? []).filter(s => s.status === status).length
                              if (count === 0) return null
                              const colors = { active: '#22c55e', pending: '#f59e0b', inactive: '#6b7280' }
                              return (
                                <div key={status} style={{
                                  display: 'flex', alignItems: 'center', gap: 6,
                                  fontSize: '0.75rem', color: colors[status],
                                }}>
                                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: colors[status] }} />
                                  {count} {status}
                                </div>
                              )
                            })}
                          </div>

                          {/* Student list */}
                          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                            {(teacherStudents.get(teacher.id) ?? []).map(student => {
                              const statusColors = { active: '#22c55e', pending: '#f59e0b', inactive: '#6b7280' }
                              return (
                                <div key={student.id} style={{
                                  display: 'flex', alignItems: 'center', gap: 10,
                                  padding: '10px 12px', borderRadius: 8,
                                  border: '1px solid var(--border-subtle)', background: 'var(--card-bg)',
                                }}>
                                  <div style={{
                                    width: 28, height: 28, borderRadius: '50%',
                                    background: 'var(--border-default)', color: 'var(--text-muted)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    fontSize: '0.7rem', fontWeight: 600, flexShrink: 0,
                                  }}>
                                    {(student.full_name || 'S').charAt(0).toUpperCase()}
                                  </div>
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                      {student.full_name || 'Unnamed Student'}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.68rem', color: 'var(--text-tertiary)' }}>
                                      <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColors[student.status] }} />
                                      {student.status}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

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
