'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  BookOpen, Plus, Trash2, X, ArrowLeft, Search,
  Users, ChevronDown, ChevronUp, UserPlus, UserMinus,
} from 'lucide-react'
import Link from 'next/link'

interface ClassItem {
  id: string
  name: string
  description: string | null
  teacher_id: string | null
  teacher_name: string | null
  student_count: number
  created_at: string
}

interface Teacher {
  id: string
  full_name: string | null
}

interface Student {
  id: string
  full_name: string | null
}

interface ClassMember {
  id: string
  student_id: string
  student_name: string
  added_at: string
}

export default function AdminClassesPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  const [classes, setClasses] = useState<ClassItem[]>([])
  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

  // Form state for creating a class
  const [formName, setFormName] = useState('')
  const [formDescription, setFormDescription] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  // Delete confirmation
  const [deleteId, setDeleteId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)

  // Expanded class for management
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [classMembers, setClassMembers] = useState<ClassMember[]>([])
  const [loadingMembers, setLoadingMembers] = useState(false)
  const [assigningTeacher, setAssigningTeacher] = useState(false)
  const [addingStudent, setAddingStudent] = useState(false)
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null)
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>('')
  const [selectedStudentId, setSelectedStudentId] = useState<string>('')

  const showAlert = useCallback((type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }, [])

  const loadClasses = useCallback(async () => {
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load classes')
      setClasses(json.data || [])
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to load classes')
    } finally {
      setLoading(false)
    }
  }, [school.schoolId, showAlert])

  const loadTeachersAndStudents = useCallback(async () => {
    try {
      const [tRes, sRes] = await Promise.all([
        fetch(`/api/schools/${school.schoolId}/teachers`),
        fetch(`/api/schools/${school.schoolId}/students`),
      ])
      const [tJson, sJson] = await Promise.all([tRes.json(), sRes.json()])

      if (tRes.ok) setTeachers((tJson.data || []).map((t: Teacher) => ({ id: t.id, full_name: t.full_name })))
      if (sRes.ok) setStudents((sJson.data || []).map((s: Student) => ({ id: s.id, full_name: s.full_name })))
    } catch {
      // non-critical
    }
  }, [school.schoolId])

  useEffect(() => {
    loadClasses()
    loadTeachersAndStudents()
  }, [loadClasses, loadTeachersAndStudents])

  const handleCreateClass = async () => {
    if (!formName.trim()) {
      showAlert('error', 'Class name is required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          description: formDescription.trim() || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to create class')

      setClasses((prev) => [json.data, ...prev])
      setFormName('')
      setFormDescription('')
      setShowForm(false)
      showAlert('success', 'Class created successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to create class')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteClass = async (classId: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes/${classId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete class')

      setClasses((prev) => prev.filter((c) => c.id !== classId))
      setDeleteId(null)
      if (expandedId === classId) setExpandedId(null)
      showAlert('success', 'Class deleted successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to delete class')
    } finally {
      setDeleting(false)
    }
  }

  const toggleExpand = async (classId: string) => {
    if (expandedId === classId) {
      setExpandedId(null)
      return
    }
    setExpandedId(classId)
    setLoadingMembers(true)

    // Pre-select the current teacher
    const cls = classes.find((c) => c.id === classId)
    setSelectedTeacherId(cls?.teacher_id || '')

    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes/${classId}/members`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load members')
      setClassMembers(json.data || [])
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to load class members')
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleAssignTeacher = async (classId: string) => {
    setAssigningTeacher(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes/${classId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teacherId: selectedTeacherId || null }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to assign teacher')

      const teacherName = selectedTeacherId
        ? teachers.find((t) => t.id === selectedTeacherId)?.full_name || null
        : null

      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId
            ? { ...c, teacher_id: selectedTeacherId || null, teacher_name: teacherName }
            : c
        )
      )
      showAlert('success', selectedTeacherId ? 'Teacher assigned' : 'Teacher removed')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to assign teacher')
    } finally {
      setAssigningTeacher(false)
    }
  }

  const handleAddStudent = async (classId: string) => {
    if (!selectedStudentId) {
      showAlert('error', 'Please select a student')
      return
    }
    setAddingStudent(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes/${classId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId: selectedStudentId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add student')

      setClassMembers((prev) => [...prev, json.data])
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId ? { ...c, student_count: c.student_count + 1 } : c
        )
      )
      setSelectedStudentId('')
      showAlert('success', 'Student added to class')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setAddingStudent(false)
    }
  }

  const handleRemoveStudent = async (classId: string, studentId: string) => {
    setRemovingStudentId(studentId)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/classes/${classId}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to remove student')

      setClassMembers((prev) => prev.filter((m) => m.student_id !== studentId))
      setClasses((prev) =>
        prev.map((c) =>
          c.id === classId ? { ...c, student_count: Math.max(0, c.student_count - 1) } : c
        )
      )
      showAlert('success', 'Student removed from class')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to remove student')
    } finally {
      setRemovingStudentId(null)
    }
  }

  const filtered = classes.filter((c) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.name.toLowerCase().includes(q) ||
      (c.description || '').toLowerCase().includes(q) ||
      (c.teacher_name || '').toLowerCase().includes(q)
    )
  })

  // Students not yet in the currently expanded class
  const availableStudents = students.filter(
    (s) => !classMembers.some((m) => m.student_id === s.id)
  )

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
          <BookOpen size={24} color="var(--warning-400)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Classes
          </h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24, paddingLeft: 32 }}>
        Manage classes, assign teachers, and enroll students for {school.schoolName}
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            placeholder="Search classes..."
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
          {showForm ? 'Cancel' : 'Create Class'}
        </Button>
      </div>

      {/* Create Class Form */}
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
            Create New Class
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Input
              label="Class Name"
              placeholder="e.g. Grade 10 Mathematics"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <Input
              label="Description"
              placeholder="Optional description"
              value={formDescription}
              onChange={(e) => setFormDescription(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 16 }}>
            <Button onClick={handleCreateClass} loading={submitting}>
              Create Class
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Classes List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {loading && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            Loading classes...
          </div>
        )}

        {!loading && filtered.length === 0 && (
          <div
            style={{
              padding: '40px 20px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '0.875rem',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
            }}
          >
            {search ? 'No classes match your search.' : 'No classes created yet. Click "Create Class" to get started.'}
          </div>
        )}

        {filtered.map((cls) => (
          <div
            key={cls.id}
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              overflow: 'hidden',
            }}
          >
            {/* Class Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: '1fr auto auto auto',
                padding: '16px 20px',
                alignItems: 'center',
                gap: 16,
              }}
            >
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                  {cls.name}
                </div>
                {cls.description && (
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 2 }}>
                    {cls.description}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: '0.75rem', color: 'var(--text-tertiary)' }}>
                  <span>Teacher: {cls.teacher_name || 'Not assigned'}</span>
                  <span>Students: {cls.student_count}</span>
                </div>
              </div>

              <Button
                size="sm"
                variant="ghost"
                icon={expandedId === cls.id ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                onClick={() => toggleExpand(cls.id)}
              >
                Manage
              </Button>

              {deleteId === cls.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm?</span>
                  <Button size="sm" variant="danger" onClick={() => handleDeleteClass(cls.id)} loading={deleting}>
                    Delete
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setDeleteId(null)}>
                    No
                  </Button>
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  icon={<Trash2 size={14} />}
                  onClick={() => setDeleteId(cls.id)}
                  style={{ color: 'var(--error-500, #ef4444)' }}
                />
              )}
            </div>

            {/* Expanded Management Panel */}
            {expandedId === cls.id && (
              <div
                style={{
                  borderTop: '1px solid var(--border-subtle)',
                  padding: '20px',
                  background: 'var(--bg-secondary, var(--card-bg))',
                }}
              >
                {/* Assign Teacher */}
                <div style={{ marginBottom: 24 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 10 }}>
                    Assign Teacher
                  </h4>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <select
                        value={selectedTeacherId}
                        onChange={(e) => setSelectedTeacherId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      >
                        <option value="">No teacher assigned</option>
                        {teachers.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.full_name || 'Unnamed'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handleAssignTeacher(cls.id)}
                      loading={assigningTeacher}
                    >
                      Save
                    </Button>
                  </div>
                </div>

                {/* Add Student */}
                <div style={{ marginBottom: 20 }}>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 10 }}>
                    Add Student
                  </h4>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                    <div style={{ flex: 1, minWidth: 200 }}>
                      <select
                        value={selectedStudentId}
                        onChange={(e) => setSelectedStudentId(e.target.value)}
                        style={{
                          width: '100%',
                          padding: '8px 12px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-subtle)',
                          background: 'var(--card-bg)',
                          color: 'var(--text-primary)',
                          fontSize: '0.875rem',
                          outline: 'none',
                        }}
                      >
                        <option value="">Select a student...</option>
                        {availableStudents.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.full_name || 'Unnamed'}
                          </option>
                        ))}
                      </select>
                    </div>
                    <Button
                      size="sm"
                      icon={<UserPlus size={14} />}
                      onClick={() => handleAddStudent(cls.id)}
                      loading={addingStudent}
                    >
                      Add
                    </Button>
                  </div>
                  {availableStudents.length === 0 && (
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 6 }}>
                      All students are already in this class, or no students exist yet.
                    </p>
                  )}
                </div>

                {/* Current Students */}
                <div>
                  <h4 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 10 }}>
                    <Users size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                    Students in this class ({classMembers.length})
                  </h4>
                  {loadingMembers ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Loading members...</p>
                  ) : classMembers.length === 0 ? (
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>No students enrolled yet.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {classMembers.map((member) => (
                        <div
                          key={member.student_id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '8px 12px',
                            borderRadius: 8,
                            background: 'var(--card-bg)',
                            border: '1px solid var(--border-subtle)',
                            fontSize: '0.85rem',
                          }}
                        >
                          <span style={{ color: 'var(--text-primary)' }}>
                            {member.student_name}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<UserMinus size={14} />}
                            onClick={() => handleRemoveStudent(cls.id, member.student_id)}
                            loading={removingStudentId === member.student_id}
                            style={{ color: 'var(--error-500, #ef4444)' }}
                          />
                        </div>
                      ))}
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
          {filtered.length} class{filtered.length !== 1 ? 'es' : ''}{search ? ' found' : ' total'}
        </p>
      )}
    </div>
  )
}
