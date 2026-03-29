'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Settings, ArrowLeft, X, Eye, EyeOff, Save } from 'lucide-react'
import Link from 'next/link'

interface SchoolSettings {
  name: string
  slug: string
  defaultTeacherPassword: string
  defaultStudentPassword: string
}

export default function AdminSettingsPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  const [settings, setSettings] = useState<SchoolSettings | null>(null)
  const [loading, setLoading] = useState(true)

  // Form state
  const [schoolName, setSchoolName] = useState('')
  const [teacherPassword, setTeacherPassword] = useState('')
  const [studentPassword, setStudentPassword] = useState('')
  const [showTeacherPw, setShowTeacherPw] = useState(false)
  const [showStudentPw, setShowStudentPw] = useState(false)

  // Save state per section
  const [savingName, setSavingName] = useState(false)
  const [savingPasswords, setSavingPasswords] = useState(false)

  // Alert state
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showAlert = useCallback((type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }, [])

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch(`/api/schools/${school.schoolId}/settings`)
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to load settings')

        const data: SchoolSettings = json.data
        setSettings(data)
        setSchoolName(data.name)
        setTeacherPassword(data.defaultTeacherPassword)
        setStudentPassword(data.defaultStudentPassword)
      } catch (err) {
        showAlert('error', err instanceof Error ? err.message : 'Failed to load settings')
      } finally {
        setLoading(false)
      }
    }
    loadSettings()
  }, [school.schoolId, showAlert])

  const handleSaveName = async () => {
    if (!schoolName.trim()) {
      showAlert('error', 'School name cannot be empty')
      return
    }

    setSavingName(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: schoolName.trim() }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update school name')

      setSettings((prev) => prev ? { ...prev, name: json.data.name } : prev)
      showAlert('success', 'School name updated successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to update school name')
    } finally {
      setSavingName(false)
    }
  }

  const handleSavePasswords = async () => {
    if (!teacherPassword.trim() || !studentPassword.trim()) {
      showAlert('error', 'Passwords cannot be empty')
      return
    }

    if (teacherPassword.length < 6 || studentPassword.length < 6) {
      showAlert('error', 'Passwords must be at least 6 characters')
      return
    }

    setSavingPasswords(true)
    try {
      const res = await fetch(`/api/schools/${school.schoolId}/settings`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          defaultTeacherPassword: teacherPassword,
          defaultStudentPassword: studentPassword,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Failed to update passwords')

      setSettings((prev) =>
        prev
          ? {
              ...prev,
              defaultTeacherPassword: json.data.defaultTeacherPassword,
              defaultStudentPassword: json.data.defaultStudentPassword,
            }
          : prev
      )
      showAlert('success', 'Default passwords updated successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to update passwords')
    } finally {
      setSavingPasswords(false)
    }
  }

  const nameChanged = settings ? schoolName.trim() !== settings.name : false
  const passwordsChanged = settings
    ? teacherPassword !== settings.defaultTeacherPassword ||
      studentPassword !== settings.defaultStudentPassword
    : false

  return (
    <div style={{ padding: '24px', maxWidth: '720px', margin: '0 auto' }}>
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
          <Settings size={24} color="var(--primary-500)" />
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
            School Settings
          </h1>
        </div>
      </div>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginBottom: 32, paddingLeft: 32 }}>
        Configure settings for {school.schoolName}
      </p>

      {loading ? (
        <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Loading settings...
        </div>
      ) : (
        <>
          {/* School Info Section */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 4 }}>
              School Information
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 20 }}>
              Basic information about your school
            </p>

            <div style={{ marginBottom: 16 }}>
              <Input
                label="School Name"
                value={schoolName}
                onChange={(e) => { if (e.target.value.length <= 30) setSchoolName(e.target.value) }}
                required
              />
              <div style={{ fontSize: '0.7rem', color: schoolName.length >= 25 ? 'var(--warning-400)' : 'var(--text-disabled)', textAlign: 'right', marginTop: '2px' }}>
                {schoolName.length}/30
              </div>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label
                style={{
                  display: 'block',
                  fontSize: '0.875rem',
                  fontWeight: 500,
                  color: 'var(--text-secondary, var(--text-primary))',
                  marginBottom: 6,
                }}
              >
                School URL Slug
              </label>
              <div
                style={{
                  padding: '8px 12px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-secondary, var(--card-bg))',
                  fontSize: '0.875rem',
                  color: 'var(--text-muted)',
                }}
              >
                /{settings?.slug}
              </div>
              <p style={{ fontSize: '0.7rem', color: 'var(--text-tertiary)', marginTop: 4 }}>
                The URL slug cannot be changed after creation.
              </p>
            </div>

            <Button
              icon={<Save size={16} />}
              onClick={handleSaveName}
              loading={savingName}
              disabled={!nameChanged}
            >
              Save Name
            </Button>
          </div>

          {/* Default Passwords Section */}
          <div
            style={{
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 12,
              padding: 24,
            }}
          >
            <h3 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: 0, marginBottom: 4 }}>
              Default Passwords
            </h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-tertiary)', marginTop: 0, marginBottom: 20 }}>
              These passwords are used when creating new teacher or student accounts without specifying a custom password.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 20 }}>
              <Input
                label="Default Teacher Password"
                type={showTeacherPw ? 'text' : 'password'}
                value={teacherPassword}
                onChange={(e) => setTeacherPassword(e.target.value)}
                rightIcon={showTeacherPw ? <EyeOff size={16} /> : <Eye size={16} />}
                onRightIconClick={() => setShowTeacherPw(!showTeacherPw)}
                required
              />
              <Input
                label="Default Student Password"
                type={showStudentPw ? 'text' : 'password'}
                value={studentPassword}
                onChange={(e) => setStudentPassword(e.target.value)}
                rightIcon={showStudentPw ? <EyeOff size={16} /> : <Eye size={16} />}
                onRightIconClick={() => setShowStudentPw(!showStudentPw)}
                required
              />
            </div>

            <Button
              icon={<Save size={16} />}
              onClick={handleSavePasswords}
              loading={savingPasswords}
              disabled={!passwordsChanged}
            >
              Save Passwords
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
