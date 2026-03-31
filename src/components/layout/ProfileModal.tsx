'use client'

import { useState, useRef } from 'react'
import { X, Camera, AlertCircle, CheckCircle2, Mail, User as UserIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

interface ProfileModalProps {
  onClose: () => void
}

export default function ProfileModal({ onClose }: ProfileModalProps) {
  const { user, updateUser } = useAppStore()
  const [fullName, setFullName] = useState(user?.fullName ?? '')
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? null)
  const fileRef = useRef<HTMLInputElement>(null)

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !user) return

    setUploading(true)
    setError(null)

    const form = new FormData()
    form.append('file', file)

    const res  = await fetch('/api/profile/avatar', { method: 'POST', body: form })
    const json = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(json?.error ?? 'Failed to upload image. Please try again.')
      setUploading(false)
      return
    }

    const url = json.data?.url
    setAvatarUrl(url)
    updateUser({ avatarUrl: url })
    setUploading(false)
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user) return
    setSaving(true)
    setError(null)

    const supabase = createClient()
    const { error: err } = await supabase.from('profiles').update({
      full_name: fullName,
      avatar_url: avatarUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', user.id)

    if (err) {
      setError(err.message)
      setSaving(false)
      return
    }

    // Sync name to Supabase Auth user metadata so it stays in sync
    await supabase.auth.updateUser({
      data: { full_name: fullName, avatar_url: avatarUrl },
    })

    updateUser({ fullName, avatarUrl })
    setSuccess(true)
    setTimeout(onClose, 1200)
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal-container">
        <div className="modal animate-modal-pop" style={{ maxWidth: '440px' }}>
          {/* Header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            paddingBottom: '16px', marginBottom: '20px',
            borderBottom: '1px solid var(--border-subtle)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{
                width: 32, height: 32, borderRadius: 'var(--radius-md)',
                background: 'rgba(99,102,241,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <UserIcon size={16} style={{ color: 'var(--primary-400)' }} />
              </div>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Edit Profile</h2>
            </div>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Avatar section */}
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px',
            marginBottom: '24px', padding: '20px',
            background: 'var(--bg-elevated)', borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--border-subtle)',
          }}>
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => fileRef.current?.click()}
            >
              <Avatar src={avatarUrl} name={user?.fullName} size="2xl" />
              <div style={{
                position: 'absolute', bottom: 2, right: 2,
                width: 30, height: 30,
                background: 'var(--primary-500)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-card)',
                boxShadow: 'var(--shadow-sm)',
                transition: 'transform var(--transition-fast)',
              }}>
                <Camera size={14} color="#fff" />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--primary-400)' }}>Uploading…</span>}
            {!uploading && (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center', margin: 0 }}>
                Click to change photo
              </p>
            )}
            {user?.role && (
              <div style={{ marginTop: '4px' }}>
                <Badge role={user.isSuperAdmin ? 'super_admin' : user.role} />
              </div>
            )}
          </div>

          {error && (
            <div className="alert alert-error animate-fade-in" style={{ marginBottom: '16px' }}>
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div className="alert alert-success animate-fade-in" style={{ marginBottom: '16px' }}>
              <CheckCircle2 size={15} style={{ flexShrink: 0 }} />
              <span>Profile updated!</span>
            </div>
          )}

          <form onSubmit={handleSave}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <Input
                label="Display name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your full name"
                required
              />

              <div>
                <label style={{
                  display: 'block', fontSize: '0.82rem', fontWeight: 600,
                  color: 'var(--text-secondary)', marginBottom: '6px',
                }}>Email</label>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '10px',
                  padding: '10px 14px', borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-elevated)', border: '1px solid var(--border-subtle)',
                  color: 'var(--text-muted)', fontSize: '0.875rem',
                }}>
                  <Mail size={15} style={{ opacity: 0.5, flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {user?.email ?? ''}
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', paddingTop: '8px' }}>
                <Button variant="ghost" type="button" onClick={onClose} style={{ flex: 1 }}>
                  Cancel
                </Button>
                <Button type="submit" loading={saving} disabled={uploading} style={{ flex: 2 }}>
                  Save changes
                </Button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  )
}

