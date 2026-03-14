'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import { Video, Plus, LogIn, Users, Clock, X, Wifi, WifiOff, CalendarClock, Timer, Check, Search, FolderOpen, Trash2, StopCircle } from 'lucide-react'

// ── Types ────────────────────────────────────────────────────────────────────
interface SessionRow {
  id: string
  title: string
  description: string | null
  status: 'live' | 'scheduled' | 'ended'
  max_participants: number
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  room_name: string
  teacher_id: string
  created_at: string
}

interface GroupOption { id: string; name: string; memberCount: number }
interface StudentOption { id: string; name: string; avatarUrl: string | null }

// ── Toast hook ────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3500)
  }, [])
  return { toast, show }
}

// ── Countdown hook ────────────────────────────────────────────────────────────
function useCountdown(target: string | null) {
  const [secondsLeft, setSecondsLeft] = useState<number>(0)

  useEffect(() => {
    if (!target) return
    const targetDate = new Date(target)
    function tick() {
      const diff = Math.max(0, Math.floor((targetDate.getTime() - Date.now()) / 1000))
      setSecondsLeft(diff)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [target])

  if (!target) return null
  const h = Math.floor(secondsLeft / 3600)
  const m = Math.floor((secondsLeft % 3600) / 60)
  const s = secondsLeft % 60
  return { secondsLeft, h, m, s }
}

// ── Generate unique room name ─────────────────────────────────────────────────
function generateRoomName(title: string): string {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 30)
  return `${slug}-${Date.now().toString(36)}`
}

// ── Create Session Modal ──────────────────────────────────────────────────────
function CreateSessionModal({ onClose, onCreated, groups, students }: {
  onClose: () => void
  onCreated: () => void
  groups: GroupOption[]
  students: StudentOption[]
}) {
  const user = useAppStore(s => s.user)
  const [title, setTitle]             = useState('')
  const [description, setDescription] = useState('')
  const [maxParticipants, setMaxParticipants] = useState('30')
  const [mode, setMode]               = useState<'now' | 'scheduled'>('now')
  const [scheduledAt, setScheduledAt] = useState('')
  const [loading, setLoading]         = useState(false)

  // Targeting
  const [targetMode, setTargetMode] = useState<'groups' | 'students'>('groups')
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')

  const minDatetime = new Date(Date.now() + 2 * 60 * 1000).toISOString().slice(0, 16)

  function toggleGroup(id: string) {
    setSelectedGroups(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }
  function toggleStudent(id: string) {
    setSelectedStudents(prev => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n })
  }

  const filteredStudents = students.filter(s => s.name.toLowerCase().includes(search.toLowerCase()))
  const filteredGroups = groups.filter(g => g.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !user?.id) return
    if (mode === 'scheduled' && !scheduledAt) return

    const hasTargets = (targetMode === 'groups' && selectedGroups.size > 0) ||
                       (targetMode === 'students' && selectedStudents.size > 0)
    if (!hasTargets) return

    setLoading(true)
    const supabase = createClient()
    const roomName = generateRoomName(title)
    const now = new Date().toISOString()

    const { data: session, error } = await supabase.from('sessions').insert({
      teacher_id: user.id,
      title: title.trim(),
      description: description.trim() || null,
      status: mode === 'now' ? 'live' : 'scheduled',
      max_participants: parseInt(maxParticipants, 10) || 30,
      scheduled_at: mode === 'scheduled' ? new Date(scheduledAt).toISOString() : null,
      started_at: mode === 'now' ? now : null,
      room_name: roomName,
    }).select('id').single()

    if (error || !session) { setLoading(false); return }

    // Insert targets
    const targets = targetMode === 'groups'
      ? Array.from(selectedGroups).map(gid => ({ session_id: session.id, target_type: 'group' as const, target_id: gid }))
      : Array.from(selectedStudents).map(sid => ({ session_id: session.id, target_type: 'student' as const, target_id: sid }))

    if (targets.length > 0) await supabase.from('session_targets').insert(targets as { session_id: string; target_type: 'group' | 'student'; target_id: string }[])
    setLoading(false)
    onCreated()
    onClose()
  }

  return (
    <div className="modal-container" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Create a Session</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>Go live now or schedule for later</p>
          </div>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>

        {/* Mode toggle */}
        <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
          {(['now', 'scheduled'] as const).map(m => (
            <button key={m} type="button" onClick={() => setMode(m)}
              style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 600, transition: 'all 0.15s',
                background: mode === m ? 'var(--primary-500)' : 'transparent', color: mode === m ? '#fff' : 'var(--text-muted)' }}>
              {m === 'now' ? '⚡ Go Live Now' : '📅 Schedule for Later'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Session Title" required placeholder="e.g. Math 101 – Live Session" value={title} onChange={e => setTitle(e.target.value)} />
          <div className="input-group">
            <label className="input-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
            <textarea className="input" rows={2} placeholder="What will you cover today?" value={description} onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: '70px' }} />
          </div>
          <Input label="Max Participants" type="number" min="2" max="200" value={maxParticipants} onChange={e => setMaxParticipants(e.target.value)} helper="Between 2 and 200 participants" />

          {mode === 'scheduled' && (
            <div className="input-group">
              <label className="input-label">Start Date &amp; Time</label>
              <input type="datetime-local" className="input" required min={minDatetime} value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} />
              <span className="input-helper">Countdown will begin immediately after saving</span>
            </div>
          )}

          {/* Target selection */}
          <div>
            <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Target Audience *</label>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '12px', background: 'var(--bg-elevated)', padding: '4px', borderRadius: 'var(--radius-md)' }}>
              <button type="button" onClick={() => setTargetMode('groups')}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                  background: targetMode === 'groups' ? 'var(--primary-500)' : 'transparent', color: targetMode === 'groups' ? '#fff' : 'var(--text-muted)' }}>
                <FolderOpen size={13} style={{ marginRight: '6px', verticalAlign: '-2px' }} />Select Groups
              </button>
              <button type="button" onClick={() => setTargetMode('students')}
                style={{ flex: 1, padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: 'none', cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600, transition: 'all 0.15s',
                  background: targetMode === 'students' ? 'var(--primary-500)' : 'transparent', color: targetMode === 'students' ? '#fff' : 'var(--text-muted)' }}>
                <Users size={13} style={{ marginRight: '6px', verticalAlign: '-2px' }} />Select Students
              </button>
            </div>

            <Input placeholder={targetMode === 'groups' ? 'Search groups…' : 'Search students…'} value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search size={14} />} />

            <div style={{ maxHeight: '180px', overflowY: 'auto', marginTop: '8px', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', background: 'var(--bg-elevated)' }}>
              {targetMode === 'groups' ? (
                filteredGroups.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {groups.length === 0 ? 'No groups created yet — create groups first' : 'No matching groups'}
                  </div>
                ) : filteredGroups.map(g => (
                  <div key={g.id} onClick={() => toggleGroup(g.id)} role="checkbox" aria-checked={selectedGroups.has(g.id)} tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleGroup(g.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      background: selectedGroups.has(g.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 'var(--radius-sm)', border: selectedGroups.has(g.id) ? 'none' : '2px solid var(--border-primary)',
                      background: selectedGroups.has(g.id) ? 'var(--primary-500)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedGroups.has(g.id) && <Check size={12} color="#fff" />}
                    </div>
                    <FolderOpen size={16} color="var(--text-muted)" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontWeight: 500 }}>{g.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.memberCount} students</div>
                    </div>
                  </div>
                ))
              ) : (
                filteredStudents.length === 0 ? (
                  <div style={{ padding: '16px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    {students.length === 0 ? 'No students enrolled yet' : 'No matching students'}
                  </div>
                ) : filteredStudents.map(s => (
                  <div key={s.id} onClick={() => toggleStudent(s.id)} role="checkbox" aria-checked={selectedStudents.has(s.id)} tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && toggleStudent(s.id)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', cursor: 'pointer', borderBottom: '1px solid var(--border-subtle)',
                      background: selectedStudents.has(s.id) ? 'rgba(99,102,241,0.08)' : 'transparent' }}>
                    <div style={{ width: 20, height: 20, borderRadius: 'var(--radius-sm)', border: selectedStudents.has(s.id) ? 'none' : '2px solid var(--border-primary)',
                      background: selectedStudents.has(s.id) ? 'var(--primary-500)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {selectedStudents.has(s.id) && <Check size={12} color="#fff" />}
                    </div>
                    <Avatar src={s.avatarUrl} name={s.name} size="xs" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{s.name}</span>
                  </div>
                ))
              )}
            </div>
            <span className="input-helper" style={{ marginTop: '4px', display: 'block' }}>
              {targetMode === 'groups'
                ? `${selectedGroups.size} group${selectedGroups.size !== 1 ? 's' : ''} selected`
                : `${selectedStudents.size} student${selectedStudents.size !== 1 ? 's' : ''} selected`}
            </span>
          </div>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '4px' }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} icon={mode === 'now' ? <Video size={15} /> : <CalendarClock size={15} />}>
              {mode === 'now' ? 'Go Live Now' : 'Schedule Session'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Join Room Modal ───────────────────────────────────────────────────────────
function JoinRoomModal({ onClose, onJoin }: { onClose: () => void; onJoin: (roomName: string) => void }) {
  const [code, setCode]   = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    await new Promise(r => setTimeout(r, 400))
    setLoading(false)
    onJoin(code.trim())
    onClose()
  }

  return (
    <div className="modal-container" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={onClose}>
      <div className="modal modal-sm" onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Join a Room</h2>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Room Name or Code" required placeholder="Enter room name" value={code} onChange={e => setCode(e.target.value)} leftIcon={<LogIn size={15} />} helper="Ask your teacher for the exact room name" />
          <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" type="button" onClick={onClose}>Cancel</Button>
            <Button type="submit" loading={loading} icon={<LogIn size={15} />}>Join Now</Button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Session Card ──────────────────────────────────────────────────────────────
function SessionCard({ session, isCreator, onEnter, onGoLive, onEnd, onDelete }: {
  session: SessionRow
  isCreator: boolean
  onEnter: (s: SessionRow) => void
  onGoLive: (s: SessionRow) => void
  onEnd: (s: SessionRow) => void
  onDelete: (s: SessionRow) => void
}) {
  const countdown = useCountdown(session.status === 'scheduled' ? session.scheduled_at : null)
  const isReady = session.status === 'scheduled' && countdown !== null && countdown.secondsLeft === 0

  const statusColor = session.status === 'live' ? 'var(--success-400)' : session.status === 'ended' ? 'var(--text-muted)' : 'var(--info-400)'
  const statusLabel = session.status.toUpperCase()

  return (
    <div className="card" style={{ padding: '20px', borderColor: session.status === 'live' ? 'rgba(74,222,128,0.25)' : undefined, opacity: session.status === 'ended' ? 0.7 : 1 }}>
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {session.status === 'live'
            ? <Wifi size={13} color={statusColor} />
            : <WifiOff size={13} color={statusColor} />}
          <span style={{ fontSize: '0.72rem', fontWeight: 700, color: statusColor, letterSpacing: '0.06em' }}>{statusLabel}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            <Users size={12} /> max {session.max_participants}
          </span>
          {isCreator && session.status !== 'ended' && (
            <button className="btn btn-ghost btn-icon btn-sm" onClick={() => onDelete(session)} aria-label="Delete" style={{ color: 'var(--danger-400)' }}><Trash2 size={13} /></button>
          )}
        </div>
      </div>

      <h3 style={{ margin: '0 0 4px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{session.title}</h3>
      <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>
        {session.description || `Room: ${session.room_name}`}
      </p>

      {/* Countdown for scheduled */}
      {session.status === 'scheduled' && countdown !== null && countdown.secondsLeft > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', padding: '10px 14px', background: 'rgba(59,130,246,0.08)', borderRadius: 'var(--radius-md)', border: '1px solid rgba(59,130,246,0.2)' }}>
          <Timer size={14} color="var(--info-400)" />
          <span style={{ fontSize: '0.82rem', color: 'var(--info-400)', fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>
            Starts in {countdown.h > 0 ? `${countdown.h}h ` : ''}{countdown.m}m {String(countdown.s).padStart(2, '0')}s
          </span>
        </div>
      )}

      {/* Actions */}
      <div style={{ display: 'flex', gap: '8px' }}>
        {session.status === 'live' && (
          <>
            <Button size="sm" icon={<Wifi size={13} />} onClick={() => onEnter(session)} style={{ flex: 1 }}>
              {isCreator ? 'Enter Room' : 'Join Session'}
            </Button>
            {isCreator && (
              <Button size="sm" variant="outline" icon={<StopCircle size={13} />} onClick={() => onEnd(session)}>End</Button>
            )}
          </>
        )}
        {session.status === 'scheduled' && isCreator && isReady && (
          <Button size="sm" icon={<Video size={13} />} onClick={() => onGoLive(session)} style={{ flex: 1 }}>
            Go Live Now!
          </Button>
        )}
        {session.status === 'scheduled' && (!isReady || !isCreator) && (
          <Button size="sm" variant="outline" icon={<Clock size={13} />} disabled style={{ flex: 1 }}>
            {isCreator ? 'Waiting…' : 'Not live yet'}
          </Button>
        )}
        {session.status === 'ended' && (
          <Button size="sm" variant="outline" icon={<Clock size={13} />} disabled style={{ flex: 1 }}>
            Session ended
          </Button>
        )}
      </div>
    </div>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────
export default function RoomsPage() {
  const router = useRouter()
  const user   = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [showCreate, setShowCreate] = useState(false)
  const [showJoin, setShowJoin]     = useState(false)
  const [sessions, setSessions]     = useState<SessionRow[]>([])
  const [groups, setGroups]         = useState<GroupOption[]>([])
  const [students, setStudents]     = useState<StudentOption[]>([])
  const [loading, setLoading]       = useState(true)

  const supabase = createClient()
  const isCreator = user?.role === 'teacher' || user?.role === 'member' || user?.role === 'admin'

  // ── Load sessions ──
  const loadSessions = useCallback(async () => {
    if (!user?.id) return

    if (isCreator) {
      // Teachers see all their sessions (not ended, plus ended within last 24h)
      const { data } = await supabase
        .from('sessions')
        .select('*')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
      if (data) setSessions(data as SessionRow[])
    } else {
      // Students: find sessions targeted at them (directly or via group)
      // 1. Direct targets
      const { data: directTargets } = await supabase
        .from('session_targets')
        .select('session_id')
        .eq('target_type', 'student')
        .eq('target_id', user.id)

      // 2. Group targets
      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)

      let groupTargetSessionIds: string[] = []
      if (myGroups && myGroups.length > 0) {
        const gids = myGroups.map(g => g.group_id)
        const { data: groupTargets } = await supabase
          .from('session_targets')
          .select('session_id')
          .eq('target_type', 'group')
          .in('target_id', gids)
        if (groupTargets) groupTargetSessionIds = groupTargets.map(t => t.session_id)
      }

      const directIds = directTargets?.map(t => t.session_id) || []
      const allIds = [...new Set([...directIds, ...groupTargetSessionIds])]

      if (allIds.length > 0) {
        const { data } = await supabase
          .from('sessions')
          .select('*')
          .in('id', allIds)
          .in('status', ['live', 'scheduled'])
          .order('created_at', { ascending: false })
        if (data) setSessions(data as SessionRow[])
      } else {
        setSessions([])
      }
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCreator])

  // ── Load groups & students for create modal ──
  const loadTargetOptions = useCallback(async () => {
    if (!user?.id || !isCreator) return

    // Groups
    const { data: groupsData } = await supabase
      .from('groups')
      .select('id, name')
      .eq('teacher_id', user.id)
      .order('name')
    if (groupsData) {
      const withCounts = await Promise.all(groupsData.map(async g => {
        const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
        return { id: g.id, name: g.name, memberCount: count ?? 0 }
      }))
      setGroups(withCounts)
    }

    // Students
    const { data: enrollments } = await supabase
      .from('teacher_students')
      .select('student_id')
      .eq('teacher_id', user.id)
    if (enrollments && enrollments.length > 0) {
      const ids = enrollments.map(e => e.student_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', ids)
      if (profiles) setStudents(profiles.map(p => ({ id: p.id, name: p.full_name || 'Student', avatarUrl: p.avatar_url })))
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCreator])

  useEffect(() => {
    if (!user?.id) return
    loadSessions()
    loadTargetOptions()

    // Real-time updates
    const channel = supabase
      .channel('sessions-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadSessions())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_targets' }, () => loadSessions())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, loadSessions, loadTargetOptions])

  function handleCreated() {
    loadSessions()
    showToast('✅ Session created!')
  }

  function handleEnter(session: SessionRow) {
    router.push(`/dashboard/rooms/${encodeURIComponent(session.room_name)}`)
  }

  async function handleGoLive(session: SessionRow) {
    const now = new Date().toISOString()
    await supabase.from('sessions').update({ status: 'live', started_at: now, updated_at: now }).eq('id', session.id)
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: 'live' as const, started_at: now } : s))
    showToast(`🚀 "${session.title}" is now live!`)
    setTimeout(() => router.push(`/dashboard/rooms/${encodeURIComponent(session.room_name)}`), 600)
  }

  async function handleEnd(session: SessionRow) {
    const now = new Date().toISOString()
    await supabase.from('sessions').update({ status: 'ended', ended_at: now, updated_at: now }).eq('id', session.id)
    setSessions(prev => prev.map(s => s.id === session.id ? { ...s, status: 'ended' as const, ended_at: now } : s))
    showToast(`✅ "${session.title}" ended`)
  }

  async function handleDelete(session: SessionRow) {
    if (!confirm(`Delete "${session.title}"? This cannot be undone.`)) return
    await supabase.from('sessions').delete().eq('id', session.id)
    setSessions(prev => prev.filter(s => s.id !== session.id))
    showToast(`✅ Session deleted`)
  }

  function handleJoin(roomName: string) {
    router.push(`/dashboard/rooms/${encodeURIComponent(roomName)}`)
  }

  const activeSessions = sessions.filter(s => s.status !== 'ended')
  const endedSessions = sessions.filter(s => s.status === 'ended')

  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Live Rooms</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isCreator ? 'Host and manage your live video sessions' : 'Join live sessions from your teachers'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {isCreator && <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Create Session</Button>}
          <Button variant={isCreator ? 'outline' : 'primary'} icon={<LogIn size={15} />} onClick={() => setShowJoin(true)}>Join Room</Button>
        </div>
      </div>

      {/* Session grid */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading sessions…</p>
        </div>
      ) : activeSessions.length > 0 || endedSessions.length > 0 ? (
        <>
          {activeSessions.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px', marginBottom: endedSessions.length > 0 ? '32px' : 0 }}>
              {activeSessions.map(session => (
                <SessionCard key={session.id} session={session} isCreator={isCreator} onEnter={handleEnter} onGoLive={handleGoLive} onEnd={handleEnd} onDelete={handleDelete} />
              ))}
            </div>
          )}
          {isCreator && endedSessions.length > 0 && (
            <>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>Past Sessions</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                {endedSessions.map(session => (
                  <SessionCard key={session.id} session={session} isCreator={isCreator} onEnter={handleEnter} onGoLive={handleGoLive} onEnd={handleEnd} onDelete={handleDelete} />
                ))}
              </div>
            </>
          )}
        </>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(99,102,241,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <Video size={28} color="var(--primary-400)" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No sessions yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
            {isCreator
              ? 'Create your first live session and target students or groups.'
              : 'No sessions assigned to you yet. Ask your teacher.'}
          </p>
          {isCreator
            ? <Button icon={<Plus size={15} />} onClick={() => setShowCreate(true)}>Create Your First Session</Button>
            : <Button icon={<LogIn size={15} />} onClick={() => setShowJoin(true)}>Join with Room Name</Button>}
        </div>
      )}

      {/* Modals */}
      {showCreate && <CreateSessionModal onClose={() => setShowCreate(false)} onCreated={handleCreated} groups={groups} students={students} />}
      {showJoin && <JoinRoomModal onClose={() => setShowJoin(false)} onJoin={handleJoin} />}

      {/* Toast */}
      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

