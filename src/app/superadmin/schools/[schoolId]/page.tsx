'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import type { School } from '@/lib/supabase/types'

async function fetchSchool(schoolId: string): Promise<School> {
  const res = await fetch(`/api/superadmin/schools/${schoolId}`)
  if (!res.ok) throw new Error('Failed to fetch school')
  const { data } = await res.json()
  return data
}

export default function SchoolDetailPage({ params }: { params: Promise<{ schoolId: string }> }) {
  const router = useRouter()
  const [schoolId, setSchoolId] = useState<string>('')
  const [school, setSchool] = useState<School | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [formData, setFormData] = useState({ name: '', primary_color: '', secondary_color: '' })
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  useEffect(() => {
    params.then(({ schoolId }) => {
      setSchoolId(schoolId)
      fetchSchool(schoolId)
        .then((data) => {
          setSchool(data)
          setFormData({
            name: data.name || '',
            primary_color: data.primary_color || '#3b82f6',
            secondary_color: data.secondary_color || '#10b981',
          })
        })
        .catch((err) => {
          console.error('Error loading school:', err)
          setError('Failed to load school')
        })
        .finally(() => setLoading(false))
    })
  }, [params])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const handleSave = async () => {
    if (!formData.name.trim()) {
      setError('School name is required')
      return
    }

    setSaving(true)
    setError('')
    setSuccess('')

    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      })
      if (!res.ok) throw new Error('Failed to update school')
      const { data: updated } = await res.json()
      setSchool(updated)
      setSuccess('School updated successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Update failed')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this school? This action cannot be undone.')) return

    setDeleting(true)
    setError('')

    try {
      const res = await fetch(`/api/superadmin/schools/${schoolId}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to delete school')
      router.push('/superadmin/schools')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Delete failed')
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading school...</div>
      </div>
    )
  }

  if (!school) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-danger)' }}>School not found</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <Link href="/superadmin/schools">
        <button className="btn btn-sm btn-secondary" style={{ marginBottom: '24px' }}>
          <ArrowLeft size={16} />
          Back
        </button>
      </Link>

      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Edit School
      </h1>

      {error && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(220, 38, 38, 0.1)', borderLeft: '4px solid var(--text-danger)' }}>
          <p style={{ margin: 0, color: 'var(--text-danger)', fontSize: '0.9rem' }}>{error}</p>
        </div>
      )}

      {success && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: '16px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderLeft: '4px solid var(--success-color)' }}>
          <p style={{ margin: 0, color: 'var(--success-color)', fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            School Name
          </label>
          <input
            type="text"
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Enter school name"
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              backgroundColor: 'var(--bg-input)',
              color: 'var(--text-primary)',
              fontSize: '0.9rem',
              boxSizing: 'border-box',
            }}
          />
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Primary Color
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="color"
              name="primary_color"
              value={formData.primary_color}
              onChange={handleChange}
              style={{ width: '60px', height: '40px', border: '1px solid var(--border-subtle)', borderRadius: '6px', cursor: 'pointer' }}
            />
            <input
              type="text"
              name="primary_color"
              value={formData.primary_color}
              onChange={handleChange}
              placeholder="#3b82f6"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ marginBottom: '20px' }}>
          <label style={{ display: 'block', marginBottom: '8px', fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
            Secondary Color
          </label>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <input
              type="color"
              name="secondary_color"
              value={formData.secondary_color}
              onChange={handleChange}
              style={{ width: '60px', height: '40px', border: '1px solid var(--border-subtle)', borderRadius: '6px', cursor: 'pointer' }}
            />
            <input
              type="text"
              name="secondary_color"
              value={formData.secondary_color}
              onChange={handleChange}
              placeholder="#10b981"
              style={{
                flex: 1,
                padding: '8px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                backgroundColor: 'var(--bg-input)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem',
                boxSizing: 'border-box',
              }}
            />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary"
            style={{ flex: 1 }}
          >
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="btn btn-danger"
          >
            <Trash2 size={16} />
            {deleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>

      <div className="card" style={{ padding: '16px', backgroundColor: 'var(--bg-secondary)' }}>
        <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          <strong>School ID:</strong> {school.id}
          <br />
          <strong>Slug:</strong> {school.slug}
          <br />
          <strong>Created:</strong> {new Date(school.created_at).toLocaleString()}
        </p>
      </div>
    </div>
  )
}
