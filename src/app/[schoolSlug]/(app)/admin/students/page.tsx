'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { GraduationCap, Plus, Trash2, X, Eye, EyeOff, ArrowLeft, Search } from 'lucide-react'
import Link from 'next/link'

interface Student {
  id: string
  full_name: string | null
  role: string
  created_at: string
}

export default function AdminStudentsPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  const [students, setStudents] = useState<Student[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState('')

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

  const loadStudents = useCallback(async () => {
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/students`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to load students')
      setStudents(json.data || [])
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to load students')
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
        .select('default_student_password')
        .eq('id', school.schoolId)
        .single()
      if (data) {
        setDefaultPassword(data.default_student_password)
        setFormPassword(data.default_student_password)
      }
    }
    loadDefaults()
  }, [school.schoolId])

  useEffect(() => {
    loadStudents()
  }, [loadStudents])

  const handleSubmit = async () => {
    if (!formName.trim() || !formEmail.trim()) {
      showAlert('error', 'Name and email are required')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/students`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: formName.trim(),
          email: formEmail.trim(),
          password: formPassword || undefined,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to add student')

      setStudents((prev) => [json.data, ...prev])
      setFormName('')
      setFormEmail('')
      setFormPassword(defaultPassword)
      setShowForm(false)
      showAlert('success', 'Student added successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to add student')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (studentId: string) => {
    setDeleting(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/students/${studentId}`, {
        method: 'DELETE',
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to delete student')

      setStudents((prev) => prev.filter((s) => s.id !== studentId))
      setDeleteId(null)
      showAlert('success', 'Student removed successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to delete student')
    } finally {
      setDeleting(false)
    }
  }

  const filtered = students.filter((s) => {
    if (!search) return true
    const q = search.toLowerCase()
    return (s.full_name || '').toLowerCase().includes(q)
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
          <GraduationCap size={24} color="var(--success-400)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            Students
          </h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 24, paddingLeft: 32 }}>
        Manage students for {school.schoolName}
      </p>

      {/* Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200, maxWidth: 320 }}>
          <Input
            placeholder="Search students..."
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
          {showForm ? 'Cancel' : 'Add Student'}
        </Button>
      </div>

      {/* Add Student Form */}
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
            Add New Student
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 16 }}>
            <Input
              label="Full Name"
              placeholder="e.g. Jane Doe"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              required
            />
            <Input
              label="Email"
              type="email"
              placeholder="e.g. jane@school.com"
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
            Default password: {defaultPassword || 'Student@123'}
          </p>
          <div style={{ display: 'flex', gap: 12 }}>
            <Button onClick={handleSubmit} loading={submitting}>
              Add Student
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Students Table */}
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
            Loading students...
          </div>
        )}

        {/* Empty state */}
        {!loading && filtered.length === 0 && (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
            {search ? 'No students match your search.' : 'No students added yet. Click "Add Student" to get started.'}
          </div>
        )}

        {/* Rows */}
        {filtered.map((student) => (
          <div
            key={student.id}
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr auto',
              padding: '14px 20px',
              borderBottom: '1px solid var(--border-subtle)',
              alignItems: 'center',
              fontSize: '0.875rem',
            }}
          >
            <div>
              <div style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                {student.full_name || 'Unnamed'}
              </div>
            </div>
            <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem' }}>
              {new Date(student.created_at).toLocaleDateString()}
            </div>
            <div>
              {deleteId === student.id ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Confirm?</span>
                  <Button
                    size="sm"
                    variant="danger"
                    onClick={() => handleDelete(student.id)}
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
                  onClick={() => setDeleteId(student.id)}
                  style={{ color: 'var(--error-500, #ef4444)' }}
                >
                  Remove
                </Button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Count */}
      {!loading && (
        <p style={{ fontSize: '0.75rem', color: 'var(--text-tertiary)', marginTop: 12, textAlign: 'right' }}>
          {filtered.length} student{filtered.length !== 1 ? 's' : ''}{search ? ' found' : ' total'}
        </p>
      )}
    </div>
  )
}
