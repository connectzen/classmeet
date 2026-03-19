'use client'

import { useState, useRef } from 'react'
import { X, Camera, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import Avatar from '@/components/ui/Avatar'
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
    const data = await res.json().catch(() => ({}))

    if (!res.ok) {
      setError(data?.error ?? 'Failed to upload image. Please try again.')
      setUploading(false)
      return
    }

    setAvatarUrl(data.url)
    updateUser({ avatarUrl: data.url })
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

    updateUser({ fullName, avatarUrl })
    setSuccess(true)
    setTimeout(onClose, 1200)
  }

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="modal-container">
        <div className="modal animate-modal-pop">
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
            <h2 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0 }}>Edit Profile</h2>
            <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close">
              <X size={18} />
            </button>
          </div>

          {/* Avatar upload */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              <Avatar src={avatarUrl} name={user?.fullName} size="2xl" />
              <div style={{
                position: 'absolute', bottom: 0, right: 0,
                width: 28, height: 28,
                background: 'var(--primary-600)',
                borderRadius: '50%',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '2px solid var(--bg-card)',
              }}>
                <Camera size={13} color="#fff" />
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleAvatarChange}
            />
            {uploading && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Uploading…</span>}
            <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textAlign: 'center' }}>
              Click avatar to upload a photo
            </p>
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
              <Input
                label="Email"
                value={user?.email ?? ''}
                disabled
                helper="Email cannot be changed here"
              />

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

