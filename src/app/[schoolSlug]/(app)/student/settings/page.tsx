'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Settings, Save, Eye, EyeOff } from 'lucide-react'

export default function StudentSettingsPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)
  const supabase = createClient()

  const [fullName, setFullName] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [loading, setLoading] = useState(true)
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null)

  const showAlert = useCallback((type: 'success' | 'error', message: string) => {
    setAlert({ type, message })
    setTimeout(() => setAlert(null), 4000)
  }, [])

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user!.id)
        .single()
      if (data) setFullName(data.full_name || '')
      setLoading(false)
    }
    if (user?.id) load()
  }, [user?.id])

  const handleSaveName = async () => {
    if (!fullName.trim()) {
      showAlert('error', 'Name cannot be empty')
      return
    }
    setSaving(true)
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: fullName.trim() })
        .eq('id', user!.id)
      if (error) throw error
      showAlert('success', 'Name updated successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to update name')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      showAlert('error', 'Password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword })
      if (error) throw error
      setNewPassword('')
      showAlert('success', 'Password changed successfully')
    } catch (err) {
      showAlert('error', err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)' }}>
        Loading settings...
      </div>
    )
  }

  return (
    <div style={{ padding: '24px', maxWidth: '640px', margin: '0 auto' }}>
      {/* Alert */}
      {alert && (
        <div
          style={{
            padding: '12px 16px', borderRadius: '8px', marginBottom: '16px',
            background: alert.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: alert.type === 'success' ? '#166534' : '#991b1b',
            fontSize: '0.875rem', fontWeight: 500,
          }}
        >
          {alert.message}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
        <Settings size={22} color="var(--text-primary)" />
        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Settings
        </h1>
      </div>

      {/* Profile Name Section */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: '12px', padding: '20px', marginBottom: '16px',
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Profile
        </h3>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          Full Name
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <Input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
          />
          <Button onClick={handleSaveName} disabled={saving} size="sm">
            <Save size={14} />
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </div>
      </div>

      {/* Change Password Section */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: '12px', padding: '20px',
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Change Password
        </h3>
        <label style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
          New Password
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <div style={{ flex: 1, position: 'relative' }}>
            <Input
              type={showPassword ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Enter new password"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              style={{
                position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
              }}
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <Button onClick={handleChangePassword} disabled={savingPassword} size="sm">
            <Save size={14} />
            {savingPassword ? 'Saving...' : 'Update'}
          </Button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0' }}>
          Must be at least 6 characters.
        </p>
      </div>

      {/* Account Info */}
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border-subtle)',
        borderRadius: '12px', padding: '20px', marginTop: '16px',
      }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>
          Account Info
        </h3>
        <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.8 }}>
          <div><strong>School:</strong> {school.schoolName}</div>
          <div><strong>Role:</strong> Student</div>
          <div><strong>Email:</strong> {user?.email}</div>
        </div>
      </div>
    </div>
  )
}
