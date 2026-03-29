'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Avatar from '@/components/ui/Avatar'
import { Users, Shield, Check, X, UserPlus, Mail, Copy, RefreshCw } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { isOwnerTier, ALL_PERMISSIONS } from '@/lib/permissions'
import type { TeacherPermissionKey } from '@/lib/supabase/types'

interface Collaborator {
  id: string
  full_name: string | null
  avatar_url: string | null
  email: string
  permissions: TeacherPermissionKey[]
}

const PERMISSION_LABELS: Record<TeacherPermissionKey, { label: string; desc: string }> = {
  invite_members: { label: 'Invite Members', desc: 'Can invite students and teachers' },
  create_groups: { label: 'Create Groups', desc: 'Can create and manage student groups' },
  create_courses: { label: 'Create Courses', desc: 'Can create and manage course content' },
  create_sessions: { label: 'Create Sessions', desc: 'Can host live video sessions' },
  manage_quizzes: { label: 'Manage Quizzes', desc: 'Can create and manage quizzes' },
  manage_settings: { label: 'Manage Settings', desc: 'Can modify workspace settings' },
}

export default function TeamPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const isOwner = isOwnerTier(user?.role, user?.teacherType)

  const loadCollaborators = useCallback(async () => {
    if (!user?.id) return
    const supabase = createClient()

    // Find all collaborators invited by this teacher
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .eq('invited_by', user.id)
      .eq('teacher_type', 'collaborator')

    if (!profiles || profiles.length === 0) {
      setCollaborators([])
      setLoading(false)
      return
    }

    // Load their permissions
    const { data: perms } = await supabase
      .from('teacher_permissions')
      .select('teacher_id, permission')
      .in('teacher_id', profiles.map(p => p.id))

    const permMap = new Map<string, TeacherPermissionKey[]>()
    for (const p of perms ?? []) {
      const existing = permMap.get(p.teacher_id) ?? []
      existing.push(p.permission as TeacherPermissionKey)
      permMap.set(p.teacher_id, existing)
    }

    setCollaborators(
      profiles.map(p => ({
        ...p,
        email: '',
        permissions: permMap.get(p.id) ?? [],
      }))
    )
    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadCollaborators() }, [loadCollaborators])

  async function togglePermission(collaboratorId: string, permission: TeacherPermissionKey, hasIt: boolean) {
    if (!user?.id) return
    setSaving(collaboratorId)
    const supabase = createClient()

    if (hasIt) {
      await supabase
        .from('teacher_permissions')
        .delete()
        .eq('teacher_id', collaboratorId)
        .eq('permission', permission)
    } else {
      await supabase
        .from('teacher_permissions')
        .insert({
          teacher_id: collaboratorId,
          granted_by: user.id,
          permission,
        })
    }

    // Refresh
    setCollaborators(prev =>
      prev.map(c => {
        if (c.id !== collaboratorId) return c
        return {
          ...c,
          permissions: hasIt
            ? c.permissions.filter(p => p !== permission)
            : [...c.permissions, permission],
        }
      })
    )
    setSaving(null)
    showToast(hasIt ? `Revoked ${PERMISSION_LABELS[permission].label}` : `Granted ${PERMISSION_LABELS[permission].label}`)
  }

  async function grantAll(collaboratorId: string) {
    if (!user?.id) return
    setSaving(collaboratorId)
    const supabase = createClient()

    const inserts = ALL_PERMISSIONS.map(p => ({
      teacher_id: collaboratorId,
      granted_by: user.id,
      permission: p,
    }))

    await supabase
      .from('teacher_permissions')
      .upsert(inserts, { onConflict: 'teacher_id,permission' })

    setCollaborators(prev =>
      prev.map(c => c.id === collaboratorId ? { ...c, permissions: [...ALL_PERMISSIONS] } : c)
    )
    setSaving(null)
    showToast('Granted all permissions')
  }

  async function revokeAll(collaboratorId: string) {
    setSaving(collaboratorId)
    const supabase = createClient()

    await supabase
      .from('teacher_permissions')
      .delete()
      .eq('teacher_id', collaboratorId)

    setCollaborators(prev =>
      prev.map(c => c.id === collaboratorId ? { ...c, permissions: [] } : c)
    )
    setSaving(null)
    showToast('Revoked all permissions')
  }

  function handleCopyLink() {
    if (!user?.id) return
    const origin = typeof window !== 'undefined' ? window.location.origin : ''
    navigator.clipboard.writeText(`${origin}/invite/${user.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    showToast('Invite link copied!')
  }

  if (!isOwner) {
    return (
      <div style={{ maxWidth: 600, padding: '40px 20px', textAlign: 'center' }}>
        <Shield size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-muted)' }}>Only workspace owners can manage team members.</p>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Users size={22} /> Team Management
          </h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Manage your collaborator teachers and their permissions
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="outline" size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </Button>
          <Button size="sm" icon={<RefreshCw size={14} />} onClick={loadCollaborators}>
            Refresh
          </Button>
        </div>
      </div>

      {/* Collaborator list */}
      {loading ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading team members...</p>
        </div>
      ) : collaborators.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <UserPlus size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
          <h3 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>No collaborators yet</h3>
          <p style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            Share your invite link with other teachers to add them as collaborators.
          </p>
          <Button icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={handleCopyLink}>
            {copied ? 'Copied!' : 'Copy Invite Link'}
          </Button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {collaborators.map(collab => (
            <div key={collab.id} className="card" style={{ padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                <Avatar src={collab.avatar_url} name={collab.full_name} size="md" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                    {collab.full_name || 'Unnamed Teacher'}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{collab.email}</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <Button variant="outline" size="sm" onClick={() => grantAll(collab.id)} disabled={saving === collab.id}>
                    Grant All
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => revokeAll(collab.id)} disabled={saving === collab.id}>
                    Revoke All
                  </Button>
                </div>
              </div>

              {/* Permission toggles */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8 }}>
                {ALL_PERMISSIONS.map(perm => {
                  const has = collab.permissions.includes(perm)
                  const info = PERMISSION_LABELS[perm]
                  return (
                    <button
                      key={perm}
                      onClick={() => togglePermission(collab.id, perm, has)}
                      disabled={saving === collab.id}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '10px 12px', borderRadius: 'var(--radius-md)',
                        border: `1px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                        background: has ? 'rgba(99,102,241,0.08)' : 'transparent',
                        cursor: 'pointer', textAlign: 'left',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{
                        width: 20, height: 20, borderRadius: 4,
                        border: `2px solid ${has ? 'var(--primary-500)' : 'var(--border-default)'}`,
                        background: has ? 'var(--primary-500)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {has && <Check size={12} color="#fff" />}
                      </div>
                      <div>
                        <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>{info.label}</div>
                        <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{info.desc}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="toast toast-info" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
