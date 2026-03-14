'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import type { UserRole } from '@/lib/supabase/types'
import { BarChart2, TrendingUp, Users, Clock, Video, BookOpen, FolderOpen, RefreshCw } from 'lucide-react'

// ── Types ─────────────────────────────────────────────────────────────────────
interface SessionRow {
  id: string; title: string; status: string; started_at: string | null; ended_at: string | null; room_name: string; created_at: string
}
interface StudentRow {
  id: string; name: string; avatarUrl: string | null; role: UserRole; enrolledAt: string
}

function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000) }, [])
  return { toast, show }
}

export default function AnalyticsPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [sessionCount, setSessionCount] = useState(0)
  const [liveCount, setLiveCount] = useState(0)
  const [studentCount, setStudentCount] = useState(0)
  const [courseCount, setCourseCount] = useState(0)
  const [groupCount, setGroupCount] = useState(0)
  const [totalMinutes, setTotalMinutes] = useState(0)
  const [recentSessions, setRecentSessions] = useState<SessionRow[]>([])
  const [topStudents, setTopStudents] = useState<StudentRow[]>([])
  const [loading, setLoading] = useState(true)

  const isCreator = user?.role === 'teacher' || user?.role === 'member' || user?.role === 'admin'

  const loadData = useCallback(async () => {
    if (!user?.id) return
    const supabase = createClient()

    // Sessions
    const { data: sessions } = await supabase
      .from('sessions')
      .select('id, title, status, started_at, ended_at, room_name, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
    if (sessions) {
      setSessionCount(sessions.length)
      setLiveCount(sessions.filter(s => s.status === 'live').length)
      setRecentSessions(sessions.slice(0, 8))
      // Calculate total teaching minutes
      let mins = 0
      for (const s of sessions) {
        if (s.started_at) {
          const start = new Date(s.started_at).getTime()
          const end = s.ended_at ? new Date(s.ended_at).getTime() : (s.status === 'live' ? Date.now() : start)
          mins += Math.max(0, Math.round((end - start) / 60000))
        }
      }
      setTotalMinutes(mins)
    }

    // Students
    const { data: enrollments } = await supabase
      .from('teacher_students')
      .select('id, student_id, enrolled_at')
      .eq('teacher_id', user.id)
      .order('enrolled_at', { ascending: false })
    if (enrollments) {
      setStudentCount(enrollments.length)
      if (enrollments.length > 0) {
        const ids = enrollments.slice(0, 10).map(e => e.student_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', ids)
        if (profiles) {
          setTopStudents(profiles.map(p => {
            const enrollment = enrollments.find(e => e.student_id === p.id)
            return {
              id: p.id,
              name: p.full_name || 'Unknown',
              avatarUrl: p.avatar_url,
              role: (p.role || 'student') as UserRole,
              enrolledAt: enrollment?.enrolled_at || '',
            }
          }))
        }
      }
    }

    // Courses
    const { count: cCount } = await supabase
      .from('courses')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', user.id)
    if (cCount !== null) setCourseCount(cCount)

    // Groups
    const { count: gCount } = await supabase
      .from('groups')
      .select('id', { count: 'exact', head: true })
      .eq('teacher_id', user.id)
    if (gCount !== null) setGroupCount(gCount)

    setLoading(false)
  }, [user?.id])

  useEffect(() => { loadData() }, [loadData])

  function formatDuration(mins: number) {
    if (mins < 60) return `${mins}m`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `${h}h ${m}m` : `${h}h`
  }

  const STATS = [
    { label: 'Total Sessions', value: String(sessionCount), sub: `${liveCount} live now`, icon: Video, color: 'var(--primary-400)', bg: 'rgba(99,102,241,0.1)' },
    { label: 'Students',       value: String(studentCount), sub: 'enrolled',               icon: Users, color: 'var(--success-400)', bg: 'rgba(34,197,94,0.1)' },
    { label: 'Courses',        value: String(courseCount),   sub: 'created',                icon: BookOpen, color: 'var(--accent-400)', bg: 'rgba(168,85,247,0.1)' },
    { label: 'Teaching Time',  value: formatDuration(totalMinutes), sub: 'total',           icon: Clock, color: 'var(--info-400)', bg: 'rgba(59,130,246,0.1)' },
  ]

  return (
    <div style={{ maxWidth: '900px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Analytics</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Track your teaching activity and student engagement
          </p>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => { setLoading(true); loadData() }} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {loading ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)' }}>Loading analytics…</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '24px' }}>
            {STATS.map(stat => {
              const Icon = stat.icon
              return (
                <div key={stat.label} className="card" style={{ padding: '20px' }}>
                  <div style={{ width: 40, height: 40, background: stat.bg, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                    <Icon size={18} color={stat.color} />
                  </div>
                  <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.sub}</div>
                </div>
              )
            })}
          </div>

          {/* Overview row */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: '12px', marginBottom: '28px' }}>
            {[
              { label: 'Groups', value: groupCount, icon: FolderOpen, color: 'var(--warning-400)' },
              { label: 'Live Now', value: liveCount, icon: TrendingUp, color: 'var(--danger-400)' },
            ].map(item => {
              const Icon = item.icon
              return (
                <div key={item.label} className="card" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Icon size={18} color={item.color} />
                  <div>
                    <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{item.value}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{item.label}</div>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Recent sessions */}
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Recent Sessions
          </h3>
          {recentSessions.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: '28px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '10px 20px', background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                <div style={{ flex: 1 }}>Title</div>
                <div style={{ width: 80, textAlign: 'center' }}>Status</div>
                <div style={{ width: 100, textAlign: 'center' }}>Duration</div>
                <div style={{ width: 110, textAlign: 'center' }}>Date</div>
              </div>
              {recentSessions.map((s, i) => {
                let duration = '—'
                if (s.started_at) {
                  const start = new Date(s.started_at).getTime()
                  const end = s.ended_at ? new Date(s.ended_at).getTime() : (s.status === 'live' ? Date.now() : start)
                  duration = formatDuration(Math.max(0, Math.round((end - start) / 60000)))
                }
                return (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '14px', padding: '12px 20px', borderBottom: i < recentSessions.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                    <div style={{ flex: 1, fontWeight: 500, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                    <div style={{ width: 80, textAlign: 'center' }}>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: 'var(--radius-full)',
                        background: s.status === 'live' ? 'rgba(239,68,68,0.15)' : s.status === 'ended' ? 'rgba(107,114,128,0.15)' : 'rgba(99,102,241,0.15)',
                        color: s.status === 'live' ? 'var(--danger-400)' : s.status === 'ended' ? 'var(--text-muted)' : 'var(--primary-400)',
                      }}>{s.status}</span>
                    </div>
                    <div style={{ width: 100, textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>{duration}</div>
                    <div style={{ width: 110, textAlign: 'center', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                      {new Date(s.created_at).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center', marginBottom: '28px' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No sessions yet. Start a live room to see data here.</p>
            </div>
          )}

          {/* Students */}
          <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
            Recent Students
          </h3>
          {topStudents.length > 0 ? (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {topStudents.map((s, i) => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 20px', borderBottom: i < topStudents.length - 1 ? '1px solid var(--border-subtle)' : 'none' }}>
                  <Avatar src={s.avatarUrl} name={s.name} size="sm" />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{s.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Enrolled {s.enrolledAt ? new Date(s.enrolledAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                  </div>
                  <Badge role={s.role} />
                </div>
              ))}
            </div>
          ) : (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>No students yet. Share your invite link to grow your classroom.</p>
            </div>
          )}
        </>
      )}

      {toast && <div className="toast toast-info" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

