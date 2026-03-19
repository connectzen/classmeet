'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import type { UserRole } from '@/lib/supabase/types'
import { UserPlus, Users, Search, X, Mail, Copy, Check, Filter, Calendar, UserMinus } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { sleep } from '@/lib/utils'

// ── Types ─────────────────────────────────────────────────────────────────────
interface Member {
  id: string
  enrollmentId: string
  name: string
  email: string
  role: UserRole
  enrolledAt: string
  enrolledAtRaw: string
  status: 'active' | 'inactive' | 'pending'
  avatarUrl: string | null
}

type FilterRole = 'all' | UserRole
type SortBy = 'newest' | 'oldest' | 'name'

// ── Invite Modal ──────────────────────────────────────────────────────────────
function InviteModal({ onClose, onInvited }: { onClose: () => void; onInvited: (email: string) => void }) {
  const user = useAppStore(s => s.user)
  const [email, setEmail]     = useState('')
  const [role, setRole]       = useState<UserRole>('student')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied]   = useState(false)

  // Each user gets a permanent invite link derived from their stable user ID
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const inviteLink = `${origin}/invite/${user?.id ?? ''}`

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 700))
    setLoading(false)
    onInvited(email.trim())
    onClose()
  }

  function copyLink() {
    navigator.clipboard.writeText(inviteLink).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="modal-container" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Invite Member</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Send an invite link or email</p>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Email address" type="email" required placeholder="student@example.com" value={email} onChange={e => setEmail(e.target.value)} leftIcon={<Mail size={15} />} />
          <div className="input-group">
            <label className="input-label">Role</label>
            <select className="input" value={role} onChange={e => setRole(e.target.value as UserRole)}>
              <option value="student">Student</option>
              <option value="teacher">Teacher</option>
            </select>
          </div>
          <div className="divider">or share link</div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <input readOnly className="input" value={inviteLink} style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }} />
            <Button type="button" variant="outline" size="sm" icon={copied ? <Check size={14} /> : <Copy size={14} />} onClick={copyLink}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} icon={<Mail size={14} />}>Send Invite</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function MembersPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [showInvite, setShowInvite] = useState(false)
  const [members, setMembers] = useState<Member[]>([])
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState<FilterRole>('all')
  const [sortBy, setSortBy] = useState<SortBy>('newest')
  const [loadingMembers, setLoadingMembers] = useState(true)

  const isCreator = user?.role === 'teacher' || user?.role === 'admin'
  const supabase = createClient()

  // ── Load teacher's students from teacher_students join table ──
  const loadMembers = useCallback(async () => {
    if (!user?.id) { setLoadingMembers(false); return }
    const { data: enrollments } = await supabase
      .from('teacher_students')
      .select('id, student_id, status, enrolled_at')
      .eq('teacher_id', user.id)

    if (enrollments && enrollments.length > 0) {
      const studentIds = enrollments.map(e => e.student_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, created_at')
        .in('id', studentIds)

      if (profiles) {
        const mapped: Member[] = profiles.map(p => {
          const enrollment = enrollments.find(e => e.student_id === p.id)
          const enrolledAt = enrollment?.enrolled_at || p.created_at
          return {
            id: p.id,
            enrollmentId: enrollment?.id || '',
            name: p.full_name || 'Unknown',
            email: '',
            role: (p.role || 'student') as UserRole,
            enrolledAt: new Date(enrolledAt).toLocaleDateString(),
            enrolledAtRaw: enrolledAt,
            status: (enrollment?.status || 'active') as 'active' | 'inactive' | 'pending',
            avatarUrl: p.avatar_url,
          }
        })
        setMembers(mapped)
      }
    } else {
      setMembers([])
    }
    setLoadingMembers(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ── Initial load + real-time subscription ──
  useEffect(() => {
    if (!user?.id) { setLoadingMembers(false); return }
    loadMembers()

    // Subscribe to real-time inserts on teacher_students
    const channel = supabase
      .channel('members-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teacher_students',
        filter: `teacher_id=eq.${user.id}`,
      }, () => {
        // Re-fetch full list whenever a student is added/updated/removed
        loadMembers()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadMembers])

  // ── Filter & sort ──
  const filtered = members
    .filter(m => {
      const matchesSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase())
      const matchesRole = filterRole === 'all' || m.role === filterRole
      return matchesSearch && matchesRole
    })
    .sort((a, b) => {
      if (sortBy === 'newest') return new Date(b.enrolledAtRaw).getTime() - new Date(a.enrolledAtRaw).getTime()
      if (sortBy === 'oldest') return new Date(a.enrolledAtRaw).getTime() - new Date(b.enrolledAtRaw).getTime()
      return a.name.localeCompare(b.name)
    })

  function handleInvited(email: string) {
    showToast(`📨 Invite sent to ${email}`)
  }

  async function handleRemoveStudent(member: Member) {
    if (!confirm(`Remove ${member.name} from your classroom?`)) return
    await supabase.from('teacher_students').delete().eq('id', member.enrollmentId)
    setMembers(prev => prev.filter(m => m.id !== member.id))
    showToast(`✅ ${member.name} removed`)
  }

  const hasFilters = search || filterRole !== 'all'

  return (
    <div style={{ maxWidth: '860px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Members</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {members.length} {members.length === 1 ? 'student' : 'students'} enrolled in your classroom
          </p>
        </div>
        {isCreator && (
          <Button icon={<UserPlus size={15} />} onClick={() => setShowInvite(true)}>Invite Member</Button>
        )}
      </div>

      {/* Search + Filters */}
      {members.length > 0 && (
        <div style={{ display: 'flex', gap: '10px', marginBottom: '20px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ flex: 1, minWidth: '200px' }}>
            <Input placeholder="Search by name…" value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search size={15} />} />
          </div>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <Filter size={14} color="var(--text-muted)" />
            <select className="input" value={filterRole} onChange={e => setFilterRole(e.target.value as FilterRole)}
              style={{ padding: '8px 12px', fontSize: '0.82rem', minWidth: '100px' }}>
              <option value="all">All Roles</option>
              <option value="student">Students</option>
              <option value="teacher">Teachers</option>
            </select>
            <select className="input" value={sortBy} onChange={e => setSortBy(e.target.value as SortBy)}
              style={{ padding: '8px 12px', fontSize: '0.82rem', minWidth: '110px' }}>
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="name">By Name</option>
            </select>
          </div>
        </div>
      )}

      {/* Loading */}
      {loadingMembers ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading members…</p>
        </div>
      ) : filtered.length > 0 ? (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {/* Table header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            <div style={{ width: 36 }} />
            <div style={{ flex: 1 }}>Name</div>
            <div style={{ width: 80, textAlign: 'center' }}>Role</div>
            <div style={{ width: 100, textAlign: 'center' }}><Calendar size={12} style={{ marginRight: 4, verticalAlign: 'middle' }} />Enrolled</div>
            <div style={{ width: 70, textAlign: 'center' }}>Status</div>
            {isCreator && <div style={{ width: 40 }} />}
          </div>
          {filtered.map((member, i) => (
            <div key={member.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '14px 20px', borderBottom: i < filtered.length - 1 ? '1px solid var(--border-subtle)' : 'none', transition: 'background 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>
              <Avatar src={member.avatarUrl} name={member.name} size="sm" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{member.name}</div>
              </div>
              <div style={{ width: 80, textAlign: 'center' }}><Badge role={member.role} /></div>
              <div style={{ width: 100, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>{member.enrolledAt}</div>
              <div style={{ width: 70, textAlign: 'center' }}>
                <span style={{
                  fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  background: member.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(250,204,21,0.15)',
                  color: member.status === 'active' ? 'var(--success-400)' : 'var(--warning-400)',
                }}>{member.status}</span>
              </div>
              {isCreator && (
                <div style={{ width: 40, textAlign: 'center' }}>
                  <button className="btn btn-ghost btn-icon btn-sm" onClick={() => handleRemoveStudent(member)}
                    title="Remove student" style={{ color: 'var(--text-muted)' }}>
                    <UserMinus size={14} />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Users size={28} color="var(--success-400)" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>
            {hasFilters ? 'No members match your filters' : 'No members yet'}
          </h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '340px', marginLeft: 'auto', marginRight: 'auto' }}>
            {hasFilters
              ? 'Try a different search or filter.'
              : 'Share your invite link to grow your classroom. Students who sign up will appear here instantly.'}
          </p>
          {isCreator && !hasFilters && (
            <Button icon={<UserPlus size={15} />} onClick={() => setShowInvite(true)}>Invite Your First Member</Button>
          )}
        </div>
      )}

      {/* Modal */}
      {showInvite && <InviteModal onClose={() => setShowInvite(false)} onInvited={handleInvited} />}

      {/* Toast */}
      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

