'use client'

import { useState, useEffect } from 'react'
import { Settings, Shield, Bell, Palette } from 'lucide-react'

interface SystemSettings {
  default_theme: string
  enable_notifications: boolean
  enable_registrations: boolean
  maintenance_mode: boolean
  max_schools: number
  default_password_expiry_days: number
}

async function fetchSettings(): Promise<SystemSettings> {
  // For now, return default settings
  // In a production system, this would fetch from the database
  return {
    default_theme: 'auto',
    enable_notifications: true,
    enable_registrations: true,
    maintenance_mode: false,
    max_schools: 0,
    default_password_expiry_days: 90,
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState('')

  useEffect(() => {
    fetchSettings()
      .then(setSettings)
      .catch((err) => {
        console.error('Error loading settings:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  const handleChange = (key: keyof SystemSettings, value: any) => {
    if (settings) {
      setSettings({ ...settings, [key]: value })
    }
  }

  const handleSave = async () => {
    setSaving(true)
    setSuccess('')

    try {
      // In production, this would make an API call
      // await fetch('/api/superadmin/settings', { method: 'PATCH', body: JSON.stringify(settings) })
      setSuccess('Settings saved successfully')
      setTimeout(() => setSuccess(''), 3000)
    } catch (err) {
      console.error('Error saving settings:', err)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading settings...</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-danger)' }}>Failed to load settings</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '800px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        System Settings
      </h1>

      {success && (
        <div className="card" style={{ padding: '12px 16px', marginBottom: '24px', backgroundColor: 'rgba(34, 197, 94, 0.1)', borderLeft: '4px solid var(--success-color)' }}>
          <p style={{ margin: 0, color: 'var(--success-color)', fontSize: '0.9rem' }}>{success}</p>
        </div>
      )}

      {/* General Settings */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Settings size={20} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            General Settings
          </h2>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Default Theme
            </label>
            <select
              value={settings.default_theme}
              onChange={(e) => handleChange('default_theme', e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            >
              <option value="auto">Auto (System preference)</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enable_registrations}
                onChange={(e) => handleChange('enable_registrations', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Allow New School Registrations
              </span>
            </label>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.maintenance_mode}
                onChange={(e) => handleChange('maintenance_mode', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Maintenance Mode
              </span>
            </label>
            {settings.maintenance_mode && (
              <p style={{ margin: '8px 0 0 26px', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Users will see a maintenance page instead of the application.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Notification Settings */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Bell size={20} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Notification Settings
          </h2>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={settings.enable_notifications}
                onChange={(e) => handleChange('enable_notifications', e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                Enable System Notifications
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Security Settings */}
      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
          <Shield size={20} style={{ color: 'var(--text-muted)' }} />
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Security Settings
          </h2>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '8px' }}>
              Default Password Expiry (days)
            </label>
            <input
              type="number"
              value={settings.default_password_expiry_days}
              onChange={(e) => handleChange('default_password_expiry_days', parseInt(e.target.value) || 90)}
              min="0"
              style={{
                width: '100%',
                maxWidth: '200px',
                padding: '8px 12px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
            <p style={{ margin: '8px 0 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Set to 0 to disable password expiry
            </p>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={handleSave}
          disabled={saving}
          className="btn btn-primary"
          style={{ flex: 1 }}
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
        <button
          onClick={() => window.location.reload()}
          className="btn btn-secondary"
        >
          Discard Changes
        </button>
      </div>
    </div>
  )
}
