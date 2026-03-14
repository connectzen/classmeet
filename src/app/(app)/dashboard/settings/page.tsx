'use client'

import { useState, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { Save, User, Bell, Shield, Trash2, Camera } from 'lucide-react'

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3200) }, [])
  return { toast, show }
}

// ── Section heading ───────────────────────────────────────────────────────────
function SectionHeading({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
      <div style={{ width: 36, height: 36, borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Icon size={17} color="var(--primary-400)" />
      </div>
      <div>
        <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--text-primary)' }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{desc}</div>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function SettingsPage() {
  const { user, updateUser } = useAppStore()
  const { toast, show: showToast } = useToast()

  const [fullName, setFullName]   = useState(user?.fullName ?? '')
  const [loading, setLoading]     = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    updateUser({ fullName: fullName.trim() })
    setLoading(false)
    showToast('✅ Profile updated successfully')
  }

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Manage your profile, notifications, and account</p>
      </div>

      {/* Profile section */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={User} title="Profile" desc="Your public identity on ClassMeet" />

        {/* Avatar picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={user?.avatarUrl} name={user?.fullName} size="lg" />
            <button
              className="btn btn-primary btn-icon btn-sm"
              style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, padding: 0, borderRadius: '50%' }}
              title="Change avatar"
              onClick={() => showToast('📸 Avatar upload — coming soon!')}
            >
              <Camera size={12} />
            </button>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px' }}>{user?.fullName || 'Your Name'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '8px' }}>{user?.email}</div>
            {user?.role && <Badge role={user.role} />}
          </div>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Full Name"
            required
            value={fullName}
            onChange={e => setFullName(e.target.value)}
            placeholder="Your full name"
          />
          <Input
            label="Email address"
            type="email"
            value={user?.email ?? ''}
            disabled
            helper="Email cannot be changed here. Contact support if needed."
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" loading={loading} icon={<Save size={14} />}>Save Changes</Button>
          </div>
        </form>
      </div>

      {/* Notifications section */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={Bell} title="Notifications" desc="Control what you hear about" />
        {(['Room starts', 'New messages', 'Quiz results', 'Course updates'] as const).map(label => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border-subtle)' }}>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{label}</span>
            <button
              className="btn btn-outline btn-sm"
              onClick={() => showToast('🔔 Notification settings — coming soon!')}
            >
              Configure
            </button>
          </div>
        ))}
      </div>

      {/* Security section */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={Shield} title="Security" desc="Password and account protection" />
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <Button variant="outline" onClick={() => showToast('🔒 Password change — coming soon!')}>Change Password</Button>
          <Button variant="outline" onClick={() => showToast('📱 Two-factor auth — coming soon!')}>Enable Two-Factor Authentication</Button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="card" style={{ padding: '28px', borderColor: 'rgba(239,68,68,0.25)' }}>
        <SectionHeading icon={Trash2} title="Danger Zone" desc="Irreversible account actions" />
        <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => showToast('⚠️ Account deletion — coming soon!')}>
          Delete My Account
        </Button>
      </div>

      {/* Toast */}
      {toast && <div className="toast toast-info" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

