'use client'

import { useState, useCallback, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import type { UserRole } from '@/lib/supabase/types'
import Badge from '@/components/ui/Badge'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import {
  Video, BookOpen, Users, BarChart2, Plus, ArrowRight,
  Clock, Sparkles, LogIn, GraduationCap, PenLine, CalendarDays, Zap,
  Radio, Circle, MessageSquare,
} from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Stat   { label: string; value: string; icon: React.ElementType; color: string; bg: string }
interface Action { label: string; desc: string; icon: React.ElementType; color: string; href?: string; comingSoon?: boolean }
interface StudentSession { id: string; title: string; status: 'live' | 'scheduled' | 'ended'; room_name: string; teacher_id: string; scheduled_at: string | null; started_at: string | null; teacher_name?: string }

// ─── Role helpers ─────────────────────────────────────────────────────────────
const isCreator = (role: UserRole | undefined) =>
  role === 'teacher' || role === 'member' || role === 'admin'

// ─── Stats per role ───────────────────────────────────────────────────────────
const TEACHER_STATS: Stat[] = [
  { label: 'Live Sessions',  value: '0', icon: Video,    color: 'var(--primary-400)', bg: 'rgba(99,102,241,0.1)'  },
  { label: 'Courses',        value: '0', icon: BookOpen, color: 'var(--accent-400)',  bg: 'rgba(168,85,247,0.1)' },
  { label: 'Students',       value: '0', icon: Users,    color: 'var(--success-400)', bg: 'rgba(34,197,94,0.1)'  },
  { label: 'Hours Taught',   value: '0', icon: BarChart2,color: 'var(--info-400)',    bg: 'rgba(59,130,246,0.1)' },
]

const STUDENT_STATS: Stat[] = [
  { label: 'Sessions Joined',   value: '0', icon: Video,          color: 'var(--primary-400)', bg: 'rgba(99,102,241,0.1)'  },
  { label: 'Enrolled Courses',  value: '0', icon: BookOpen,       color: 'var(--accent-400)',  bg: 'rgba(168,85,247,0.1)' },
  { label: 'Quizzes Taken',     value: '0', icon: PenLine,        color: 'var(--success-400)', bg: 'rgba(34,197,94,0.1)'  },
  { label: 'Study Hours',       value: '0', icon: GraduationCap,  color: 'var(--info-400)',    bg: 'rgba(59,130,246,0.1)' },
]

// ─── Quick actions per role ───────────────────────────────────────────────────
const TEACHER_ACTIONS: Action[] = [
  { label: 'Start Live Room',  desc: 'Host a video session now',  icon: Video,    color: 'var(--primary-500)', href: '/dashboard/rooms'   },
  { label: 'Create Course',    desc: 'Build and share content',   icon: BookOpen,     color: 'var(--accent-500)',   href: '/dashboard/courses'   },
  { label: 'Invite Members',   desc: 'Grow your classroom',       icon: Users,        color: 'var(--success-400)',  href: '/dashboard/members'   },
  { label: 'Messages',         desc: 'Chat with your students',   icon: MessageSquare,color: 'var(--warning-400)',  href: '/dashboard/messages'  },
  { label: 'Schedule Session', desc: 'Plan ahead with calendar',  icon: CalendarDays, color: 'var(--info-400)',     href: '/dashboard/rooms'     },
  { label: 'View Analytics',   desc: 'Track your engagement',     icon: BarChart2,    color: 'var(--accent-400)',   href: '/dashboard/analytics' },
]

const STUDENT_ACTIONS: Action[] = [
  { label: 'Join a Room',      desc: 'Enter a live class session', icon: LogIn,        color: 'var(--primary-500)', href: '/dashboard/rooms'    },
  { label: 'Browse Courses',   desc: 'Explore available courses',  icon: BookOpen,     color: 'var(--accent-500)',  href: '/dashboard/courses'  },
  { label: 'Messages',         desc: 'Chat with your teachers',    icon: MessageSquare,color: 'var(--success-400)', href: '/dashboard/messages' },
  { label: 'My Schedule',      desc: 'View upcoming sessions',     icon: CalendarDays, color: 'var(--info-400)',    href: '/dashboard/rooms'    },
]

// ─── Toast ────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }, [])
  return { toast, show }
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router  = useRouter()
  const user    = useAppStore((s) => s.user)
  const { toast, show: showToast } = useToast()
  const [studentCount, setStudentCount] = useState(0)
  const [courseCount, setCourseCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [teachers, setTeachers] = useState<{ id: string; full_name: string | null; avatar_url: string | null; subjects: string[] }[]>([])
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([])

  const creator = isCreator(user?.role)

  // Process pending teacher-student enrollment + load counts + real-time subscription
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()

    // ── Process pending teacher link from localStorage ──
    const pendingTeacher = localStorage.getItem('classmeet_teacher_id')
    const pendingRef = localStorage.getItem('classmeet_referrer')

    if (pendingTeacher && pendingTeacher !== user.id) {
      localStorage.removeItem('classmeet_teacher_id')
      localStorage.removeItem('classmeet_referrer')
      // Add teacher-student link (allows multiple teachers per student)
      supabase.from('teacher_students')
        .upsert({ teacher_id: pendingTeacher, student_id: user.id }, { onConflict: 'teacher_id,student_id' })
        .then(() => {
          // Also update legacy referral tracking
          supabase.from('profiles').update({ referred_by: pendingTeacher }).eq('id', user.id)
          supabase.from('referrals')
            .upsert({ referrer_id: pendingTeacher, referred_id: user.id }, { onConflict: 'referred_id' })
          // Re-fetch student count
          supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
            .then(({ count }) => { if (count !== null) setStudentCount(count) })
        })
    } else if (pendingRef && pendingRef !== user.id) {
      localStorage.removeItem('classmeet_referrer')
      // Fallback: only referral without teacher link
      supabase.from('profiles').update({ referred_by: pendingRef }).eq('id', user.id)
      supabase.from('referrals')
        .upsert({ referrer_id: pendingRef, referred_id: user.id }, { onConflict: 'referred_id' })
    }

    // ── Load counts ──
    supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
      .then(({ count }) => { if (count !== null) setStudentCount(count) })
    supabase.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
      .then(({ count }) => { if (count !== null) setCourseCount(count) })
    supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
      .then(({ count }) => { if (count !== null) setSessionCount(count) })

    // ── Load student's teachers + sessions ──
    if (!isCreator(user.role)) {
      supabase
        .from('teacher_students')
        .select('teacher_id')
        .eq('student_id', user.id)
        .then(async ({ data: enrollments }) => {
          if (enrollments && enrollments.length > 0) {
            const teacherIds = enrollments.map(e => e.teacher_id)
            const { data: profiles } = await supabase
              .from('profiles')
              .select('id, full_name, avatar_url, subjects')
              .in('id', teacherIds)
            if (profiles) setTeachers(profiles)
          }
        })

      // Load live + scheduled sessions targeted at this student
      const loadStudentSessions = async () => {
        const { data: directTargets } = await supabase
          .from('session_targets')
          .select('session_id')
          .eq('target_type', 'student')
          .eq('target_id', user.id)

        const { data: myGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('student_id', user.id)

        let groupSessionIds: string[] = []
        if (myGroups && myGroups.length > 0) {
          const gids = myGroups.map(g => g.group_id)
          const { data: groupTargets } = await supabase
            .from('session_targets')
            .select('session_id')
            .eq('target_type', 'group')
            .in('target_id', gids)
          if (groupTargets) groupSessionIds = groupTargets.map(t => t.session_id)
        }

        const directIds = directTargets?.map(t => t.session_id) || []
        const allIds = [...new Set([...directIds, ...groupSessionIds])]

        if (allIds.length > 0) {
          const { data: sessions } = await supabase
            .from('sessions')
            .select('id, title, status, room_name, teacher_id, scheduled_at, started_at')
            .in('id', allIds)
            .in('status', ['live', 'scheduled'])
            .order('created_at', { ascending: false })

          if (sessions && sessions.length > 0) {
            // Fetch teacher names
            const tIds = [...new Set(sessions.map(s => s.teacher_id))]
            const { data: tProfiles } = await supabase
              .from('profiles')
              .select('id, full_name')
              .in('id', tIds)
            const nameMap = new Map(tProfiles?.map(p => [p.id, p.full_name]) || [])
            setStudentSessions(sessions.map(s => ({ ...s, teacher_name: nameMap.get(s.teacher_id) || 'Teacher' })) as StudentSession[])
          } else {
            setStudentSessions([])
          }
        } else {
          setStudentSessions([])
        }
      }
      loadStudentSessions()

      // Real-time: reload sessions when they change
      const sessChannel = supabase
        .channel('dashboard-student-sessions')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => loadStudentSessions())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'session_targets' }, () => loadStudentSessions())
        .subscribe()

      // Return cleanup that also removes this channel
      const origCleanup = () => { supabase.removeChannel(sessChannel) }
      // We'll handle this below in the main cleanup
      ;(window as unknown as Record<string, () => void>).__dashSessCleanup = origCleanup
    }

    // ── Real-time subscription: update counts + teacher list instantly ──
    const channel = supabase
      .channel('dashboard-realtime')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teacher_students',
        filter: `teacher_id=eq.${user.id}`,
      }, () => {
        supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
          .then(({ count }) => { if (count !== null) setStudentCount(count) })
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teacher_students',
        filter: `student_id=eq.${user.id}`,
      }, async () => {
        // Re-fetch teachers for student
        const { data: enrollments } = await supabase
          .from('teacher_students')
          .select('teacher_id')
          .eq('student_id', user.id)
        if (enrollments && enrollments.length > 0) {
          const teacherIds = enrollments.map(e => e.teacher_id)
          const { data: profiles } = await supabase
            .from('profiles')
            .select('id, full_name, avatar_url, subjects')
            .in('id', teacherIds)
          if (profiles) setTeachers(profiles)
        } else {
          setTeachers([])
        }
      })
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'sessions',
        filter: `teacher_id=eq.${user.id}`,
      }, () => {
        supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id)
          .then(({ count }) => { if (count !== null) setSessionCount(count) })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
      const sessCleanup = (window as unknown as Record<string, () => void>).__dashSessCleanup
      if (sessCleanup) { sessCleanup(); delete (window as unknown as Record<string, () => void>).__dashSessCleanup }
    }
  }, [user?.id])

  const teacherStats = TEACHER_STATS.map(s => {
    if (s.label === 'Students') return { ...s, value: String(studentCount) }
    if (s.label === 'Courses') return { ...s, value: String(courseCount) }
    if (s.label === 'Live Sessions') return { ...s, value: String(sessionCount) }
    return s
  })

  const studentStats = STUDENT_STATS.map(s => {
    if (s.label === 'Sessions Joined') return { ...s, value: String(studentSessions.length) }
    return s
  })

  const stats   = creator ? teacherStats  : studentStats
  const actions = creator ? TEACHER_ACTIONS : STUDENT_ACTIONS

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  })()

  const bannerSubtitle = creator
    ? 'Manage your rooms, courses, and students all in one place.'
    : 'Join live sessions, take quizzes, and learn at your own pace.'

  function handleAction(action: Action) {
    if (action.comingSoon) {
      showToast(`✨ ${action.label} — coming soon!`)
    } else if (action.href) {
      router.push(action.href)
    }
  }

  function handleNewSession() {
    if (creator) {
      router.push('/dashboard/rooms')
    } else {
      router.push('/dashboard/rooms')
    }
  }

  return (
    <div style={{ maxWidth: '960px' }}>

      {/* ── Welcome banner ────────────────────────────────────────────────── */}
      <div
        className="card card-elevated stagger-item"
        style={{
          marginBottom: '24px', padding: '28px 32px',
          background: 'linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(168,85,247,0.08) 100%)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Avatar src={user?.avatarUrl} name={user?.fullName} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {greeting}, {user?.fullName?.split(' ')[0] ?? 'there'}! 👋
              </h2>
              {user?.role && <Badge role={user.role} />}
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>{bannerSubtitle}</p>
          </div>
          <Button icon={<Plus size={16} />} size="sm" onClick={handleNewSession}>
            {creator ? 'New Session' : 'Join Room'}
          </Button>
        </div>
      </div>

      {/* ── Live & Upcoming Sessions (students only) ──────────────────── */}
      {!creator && studentSessions.length > 0 && (
        <div className="card stagger-item" style={{ marginBottom: '24px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="var(--danger-400)" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                Live &amp; Upcoming Sessions
              </h3>
              {studentSessions.some(s => s.status === 'live') && (
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '4px',
                  padding: '2px 8px', borderRadius: 'var(--radius-full)',
                  background: 'rgba(239,68,68,0.15)', color: 'var(--danger-400)',
                  fontSize: '0.68rem', fontWeight: 700,
                }}>
                  <Circle size={6} fill="var(--danger-400)" color="var(--danger-400)" style={{ animation: 'pulse 2s ease-in-out infinite' }} />
                  LIVE NOW
                </span>
              )}
            </div>
            <Button variant="ghost" size="sm" onClick={() => router.push('/dashboard/rooms')}>
              View all <ArrowRight size={12} />
            </Button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {studentSessions.slice(0, 5).map(s => (
              <div
                key={s.id}
                className="card card-interactive"
                onClick={() => {
                  if (s.status === 'live') router.push(`/dashboard/rooms/${encodeURIComponent(s.room_name)}`)
                  else router.push('/dashboard/rooms')
                }}
                role="button"
                tabIndex={0}
                onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (s.status === 'live' ? router.push(`/dashboard/rooms/${encodeURIComponent(s.room_name)}`) : router.push('/dashboard/rooms'))}
                style={{
                  padding: '14px 16px', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '14px',
                  border: s.status === 'live' ? '1px solid var(--danger-400)' : undefined,
                  background: s.status === 'live' ? 'rgba(239,68,68,0.04)' : undefined,
                }}
              >
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)', flexShrink: 0,
                  background: s.status === 'live' ? 'rgba(239,68,68,0.12)' : 'rgba(99,102,241,0.1)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {s.status === 'live'
                    ? <Video size={18} color="var(--danger-400)" />
                    : <CalendarDays size={18} color="var(--primary-400)" />
                  }
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {s.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {s.teacher_name} · {s.status === 'live' ? 'Started ' + (s.started_at ? new Date(s.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'just now') : s.scheduled_at ? new Date(s.scheduled_at).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'No date set'}
                  </div>
                </div>
                <span style={{
                  padding: '3px 10px', borderRadius: 'var(--radius-full)', fontSize: '0.7rem', fontWeight: 700,
                  background: s.status === 'live' ? 'var(--danger-500)' : 'rgba(99,102,241,0.15)',
                  color: s.status === 'live' ? '#fff' : 'var(--primary-400)',
                }}>
                  {s.status === 'live' ? 'JOIN NOW' : 'SCHEDULED'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Stats ─────────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '28px' }}>
        {stats.map((stat, i) => {
          const Icon = stat.icon
          return (
            <div key={stat.label} className="card stagger-item" style={{ animationDelay: `${i * 60}ms`, padding: '20px' }}>
              <div style={{ width: 40, height: 40, background: stat.bg, borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={18} color={stat.color} />
              </div>
              <div style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{stat.value}</div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '4px' }}>{stat.label}</div>
            </div>
          )
        })}
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Quick Actions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {actions.map((action, i) => {
          const Icon = action.icon
          return (
            <div
              key={action.label}
              className="card card-interactive dash-action-card stagger-item"
              style={{ animationDelay: `${(i + 4) * 60}ms`, padding: '20px', cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onClick={() => handleAction(action)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleAction(action)}
            >
              <div className="dash-action-icon" style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: `color-mix(in srgb, ${action.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={20} color={action.color} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>{action.label}</span>
                {action.comingSoon && (
                  <span style={{ fontSize: '0.65rem', padding: '1px 6px', borderRadius: 'var(--radius-full)', background: 'rgba(168,85,247,0.15)', color: 'var(--accent-400)', border: '1px solid rgba(168,85,247,0.25)', fontWeight: 600, letterSpacing: '0.03em' }}>SOON</span>
                )}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '12px' }}>{action.desc}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', color: action.color, fontWeight: 500 }}>
                {action.comingSoon
                  ? <>Learn more <span className="dash-action-arrow"><Zap size={11} /></span></>
                  : <>Get started <span className="dash-action-arrow"><ArrowRight size={12} /></span></>}
              </div>
            </div>
          )
        })}
      </div>

      {/* ── Recent Activity placeholder ───────────────────────────────────── */}
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Recent Activity
      </h3>
      <div className="card stagger-item" style={{ animationDelay: '420ms', padding: '40px', textAlign: 'center' }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
          <Clock size={24} color="var(--text-muted)" />
        </div>
        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No activity yet</div>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>
          {creator
            ? 'Your sessions, courses, and student activity will appear here.'
            : 'Your joined sessions, quiz results, and course progress will appear here.'}
        </p>
        <Button variant="outline" size="sm" icon={<Sparkles size={14} />} onClick={() => showToast('✨ Feature tour — coming soon!')}>
          Explore features
        </Button>
      </div>

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="toast toast-info" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}

