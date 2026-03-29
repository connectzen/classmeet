'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import { Save, User, Shield, Trash2, Camera, Lock, AlertCircle, CheckCircle2, Eye, EyeOff, ImageIcon } from 'lucide-react'
import { useToast } from '@/hooks/useToast'

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

export default function SettingsPage() {
  const router = useRouter()
  const { user, updateUser } = useAppStore()
  const { toast, show: showToast } = useToast()

  // ── Profile ──────────────────────────────────────────────────────────────
  const [fullName, setFullName]     = useState(user?.fullName ?? '')
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileError, setProfileError]   = useState<string | null>(null)
  const [profileOk, setProfileOk]         = useState(false)

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim() || !user) return
    setSavingProfile(true)
    setProfileError(null)
    setProfileOk(false)

    const supabase = createClient()
    const { error } = await supabase
      .from('profiles')
      .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
      .eq('id', user.id)

    if (error) { setProfileError(error.message); setSavingProfile(false); return }

    await supabase.auth.updateUser({ data: { full_name: fullName.trim() } })
    updateUser({ fullName: fullName.trim() })
    setSavingProfile(false)
    setProfileOk(true)
    setTimeout(() => setProfileOk(false), 3000)
  }

  // ── Avatar upload ──────────────────────────────────────────────────────
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    setProfileError(null)

    const form = new FormData()
    form.append('file', file)

    const res = await fetch('/api/profile/avatar', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setProfileError(json?.error ?? 'Failed to upload image.')
      setUploading(false)
      return
    }

    const url = json.data?.url
    updateUser({ avatarUrl: url })
    setUploading(false)
    showToast('Photo updated!')
  }

  // ── Change password ───────────────────────────────────────────────────────
  const [showPwForm, setShowPwForm]   = useState(false)
  const [newPw,      setNewPw]        = useState('')
  const [confirmPw,  setConfirmPw]    = useState('')
  const [showPw,     setShowPw]       = useState(false)
  const [changingPw, setChangingPw]   = useState(false)
  const [pwError,    setPwError]      = useState<string | null>(null)
  const [pwOk,       setPwOk]         = useState(false)

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPw.length < 8) { setPwError('Password must be at least 8 characters.'); return }
    if (newPw !== confirmPw) { setPwError('Passwords do not match.'); return }

    setChangingPw(true)
    setPwError(null)

    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPw })

    setChangingPw(false)
    if (error) { setPwError(error.message); return }

    setPwOk(true)
    setNewPw(''); setConfirmPw('')
    setTimeout(() => { setPwOk(false); setShowPwForm(false) }, 2000)
  }

  // ── Delete account ────────────────────────────────────────────────────────
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting,      setDeleting]      = useState(false)
  const [deleteError,   setDeleteError]   = useState<string | null>(null)

  async function handleDeleteAccount() {
    setDeleting(true)
    setDeleteError(null)

    const res  = await fetch('/api/profile/account', { method: 'DELETE' })
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setDeleteError(data?.error ?? 'Could not delete account. Please try again.')
      setDeleting(false)
      return
    }

    // Sign out locally and redirect
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/sign-in')
  }

  return (
    <div style={{ maxWidth: '680px' }}>
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Settings</h1>
        <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>Manage your profile, photo, and account</p>
      </div>

      {/* ── Profile ────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={User} title="Profile" desc="Your public identity on ClassMeet" />

        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '24px' }}>
          <div style={{ position: 'relative' }}>
            <Avatar src={user?.avatarUrl} name={user?.fullName} size="lg" />
            <input
              ref={fileRef}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              style={{ display: 'none' }}
              onChange={handleAvatarUpload}
            />
            <button
              className="btn btn-primary btn-icon btn-sm"
              style={{ position: 'absolute', bottom: -4, right: -4, width: 26, height: 26, padding: 0, borderRadius: '50%' }}
              title="Change photo"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
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
          {profileError && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{profileError}</span>
            </div>
          )}
          {profileOk && (
            <div className="alert alert-success animate-fade-in">
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} /><span>Profile updated!</span>
            </div>
          )}
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
            <Button type="submit" loading={savingProfile} icon={<Save size={14} />}>Save Changes</Button>
          </div>
        </form>
      </div>

      {/* ── Photo ──────────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={Camera} title="Profile Photo" desc="Upload or change your profile picture" />
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <Avatar src={user?.avatarUrl} name={user?.fullName} size="xl" />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <Button
              variant="outline"
              icon={<Camera size={14} />}
              loading={uploading}
              onClick={() => fileRef.current?.click()}
            >
              {user?.avatarUrl ? 'Change Photo' : 'Upload Photo'}
            </Button>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              JPG, PNG or WebP. Max 2 MB.
            </span>
          </div>
        </div>
      </div>

      {/* ── Security ───────────────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: '16px', padding: '28px' }}>
        <SectionHeading icon={Shield} title="Security" desc="Password and account protection" />

        {!showPwForm ? (
          <Button variant="outline" icon={<Lock size={14} />} onClick={() => { setShowPwForm(true); setPwError(null); setPwOk(false) }}>
            Change Password
          </Button>
        ) : (
          <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            {pwError && (
              <div className="alert alert-error animate-fade-in">
                <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{pwError}</span>
              </div>
            )}
            {pwOk && (
              <div className="alert alert-success animate-fade-in">
                <CheckCircle2 size={15} style={{ flexShrink: 0 }} /><span>Password changed!</span>
              </div>
            )}
            <Input
              label="New password"
              type={showPw ? 'text' : 'password'}
              required
              placeholder="At least 8 characters"
              value={newPw}
              onChange={e => setNewPw(e.target.value)}
              leftIcon={<Lock size={15} />}
              rightIcon={
                <button type="button" onClick={() => setShowPw(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              }
            />
            <Input
              label="Confirm new password"
              type={showPw ? 'text' : 'password'}
              required
              placeholder="Repeat your new password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              leftIcon={<Lock size={15} />}
            />
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="ghost" type="button" onClick={() => { setShowPwForm(false); setNewPw(''); setConfirmPw(''); setPwError(null) }}>
                Cancel
              </Button>
              <Button type="submit" loading={changingPw}>Save Password</Button>
            </div>
          </form>
        )}
      </div>

      {/* ── Danger zone ────────────────────────────────────────────────────── */}
      <div className="card" style={{ padding: '28px', borderColor: 'rgba(239,68,68,0.25)' }}>
        <SectionHeading icon={Trash2} title="Danger Zone" desc="Irreversible account actions" />

        {deleteError && (
          <div className="alert alert-error animate-fade-in" style={{ marginBottom: '14px' }}>
            <AlertCircle size={15} style={{ flexShrink: 0 }} /><span>{deleteError}</span>
          </div>
        )}

        {!confirmDelete ? (
          <Button variant="danger" icon={<Trash2 size={14} />} onClick={() => setConfirmDelete(true)}>
            Delete My Account
          </Button>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--error-400)', fontWeight: 500 }}>
              This will permanently delete your account and all your data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="ghost" onClick={() => { setConfirmDelete(false); setDeleteError(null) }}>Cancel</Button>
              <Button variant="danger" loading={deleting} icon={<Trash2 size={14} />} onClick={handleDeleteAccount}>
                Yes, delete my account
              </Button>
            </div>
          </div>
        )}
      </div>

      {toast && <div className="toast toast-info" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
