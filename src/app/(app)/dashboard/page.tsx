'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import AdminDashboard from '@/components/dashboard/AdminDashboard'
import {
  Video, BookOpen, Users, ArrowRight,
  Clock, CalendarDays, Zap, MessageSquare,
  Radio, Circle, Wifi, WifiOff, GraduationCap,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { isCreatorRole, getDashboardBasePath } from '@/lib/utils'
import { useCountdown } from '@/hooks/useCountdown'
import { canInviteMembers, canCreateCourses, canCreateSessions, canManageQuizzes } from '@/lib/permissions'
import type { TeacherPermissionKey } from '@/lib/supabase/types'

// ─── Types ────────────────────────────────────────────────────────────────────
interface Action { label: string; desc: string; icon: React.ElementType; color: string; href?: string; comingSoon?: boolean; statKey?: string; permissionCheck?: (perms: TeacherPermissionKey[]) => boolean }
interface StudentSession { id: string; title: string; status: 'live' | 'scheduled' | 'ended'; room_name: string; teacher_id: string; scheduled_at: string | null; started_at: string | null; teacher_name?: string }
interface ActivityItem { id: string; type: 'session' | 'course' | 'student'; title: string; time: string; icon: React.ElementType; color: string }

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}

// ─── Dashboard Session Card ───────────────────────────────────────────────────
function DashSessionCard({ session, onJoin }: { session: StudentSession; onJoin: () => void }) {
  const countdown = useCountdown(session.status === 'scheduled' ? session.scheduled_at : null)
  const isLive = session.status === 'live'
  const statusColor = isLive ? 'var(--success-400)' : 'var(--info-400)'

  return (
    <div className="card" style={{
      padding: '20px', display: 'flex', flexDirection: 'column', minHeight: '260px',
      borderColor: isLive ? 'rgba(74,222,128,0.25)' : undefined,
      cursor: 'pointer',
    }} onClick={isLive ? onJoin : undefined}>
      {/* Title */}
      <h3 style={{ margin: '0 0 10px', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>
        {session.title}
      </h3>

      {/* Status row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {isLive ? <Wifi size={13} color="#22c55e" /> : <WifiOff size={13} color={statusColor} />}
          <span style={{ 
            fontSize: '0.72rem', 
            fontWeight: 700, 
            color: isLive ? '#22c55e' : statusColor, 
            letterSpacing: '0.06em',
            animation: isLive ? 'pulse-glow 2s ease-in-out infinite' : 'none',
            textShadow: isLive ? '0 0 8px rgba(34, 197, 94, 0.3)' : 'none'
          }}>
            {isLive ? 'LIVE' : 'SCHEDULED'}
          </span>
        </div>
        {!isLive && (
          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: 'var(--info-400)', background: 'rgba(59,130,246,0.1)', padding: '2px 8px', borderRadius: '9999px' }}>
            Starts in
          </span>
        )}
      </div>

      {/* Center */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 0' }}>
        {isLive && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ 
              fontSize: '2.8rem', 
              fontWeight: 800, 
              color: '#22c55e', 
              letterSpacing: '0.06em', 
              lineHeight: 1,
              animation: 'pulse-glow 2s ease-in-out infinite',
              textShadow: '0 0 16px rgba(34, 197, 94, 0.4)'
            }}>
              ONGOING
            </div>
            <div style={{ 
              fontSize: '1.4rem', 
              fontWeight: 700, 
              color: '#22c55e', 
              opacity: 0.8, 
              letterSpacing: '0.1em', 
              marginTop: '4px',
              animation: 'pulse-glow 2s ease-in-out infinite',
              textShadow: '0 0 12px rgba(34, 197, 94, 0.3)'
            }}>
              NOW
            </div>
          </div>
        )}
        {!isLive && countdown !== null && countdown.secondsLeft > 0 && (
          <div style={{ textAlign: 'center', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>
            {countdown.h > 0 && (
              <span style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--info-400)', letterSpacing: '-0.02em' }}>
                {countdown.h}<span style={{ fontSize: '1.4rem', fontWeight: 600, opacity: 0.75 }}>h </span>
              </span>
            )}
            <span style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--info-400)', letterSpacing: '-0.02em' }}>
              {countdown.h > 0 ? String(countdown.m).padStart(2, '0') : countdown.m}
              <span style={{ fontSize: '1.4rem', fontWeight: 600, opacity: 0.75 }}>m </span>
            </span>
            <span style={{ fontSize: '3.5rem', fontWeight: 800, color: 'var(--info-400)', letterSpacing: '-0.02em' }}>
              {String(countdown.s).padStart(2, '0')}
              <span style={{ fontSize: '1.4rem', fontWeight: 600, opacity: 0.75 }}>s</span>
            </span>
          </div>
        )}
        {!isLive && countdown !== null && countdown.secondsLeft === 0 && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--success-400)' }}>Starting!</div>
          </div>
        )}
      </div>

      {/* Bottom */}
      <div style={{ marginTop: 'auto' }}>
        {isLive ? (
          <button onClick={e => { e.stopPropagation(); onJoin() }}
            style={{ width: '100%', padding: '8px', background: 'var(--primary-500)', color: '#fff', border: 'none', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Wifi size={14} /> Join Session
          </button>
        ) : (
          <button disabled
            style={{ width: '100%', padding: '8px', background: 'transparent', color: 'var(--text-muted)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 500, cursor: 'not-allowed', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Clock size={14} /> Not live yet
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Quick actions per role ───────────────────────────────────────────────────
const TEACHER_ACTIONS: Action[] = [
  { label: 'Start Live Room',  desc: 'Host a video session',  icon: Video,    color: 'var(--primary-500)', href: 'rooms',   statKey: 'sessionCount', permissionCheck: (p) => canCreateSessions(p) },
  { label: 'Create Course',    desc: 'Build course content',   icon: BookOpen,     color: 'var(--accent-500)',   href: 'courses', statKey: 'courseCount', permissionCheck: (p) => canCreateCourses(p)   },
  { label: 'Invite Members',   desc: 'Manage your students',       icon: Users,        color: 'var(--success-400)',  href: 'members',   statKey: 'studentCount', permissionCheck: (p) => canInviteMembers(p) },
  { label: 'Messages',         desc: 'Chat with students',   icon: MessageSquare,color: 'var(--warning-400)',  href: 'messages'  },
]

const STUDENT_ACTIONS: Action[] = [
  { label: 'Join a Room',      desc: 'Enter a live class', icon: Video,        color: 'var(--primary-500)', href: 'rooms',    statKey: 'sessionsJoined' },
  { label: 'Browse Courses',   desc: 'Explore courses',  icon: BookOpen,     color: 'var(--accent-500)',  href: 'courses', statKey: 'enrolledCourseCount'  },
  { label: 'Messages',         desc: 'Chat with teachers',    icon: MessageSquare,color: 'var(--success-400)', href: 'messages' },
  { label: 'My Schedule',      desc: 'View sessions',     icon: CalendarDays, color: 'var(--info-400)',    href: 'rooms'    },
]

// ─── Component ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const router  = useRouter()
  const user    = useAppStore((s) => s.user)
  const basePath = getDashboardBasePath(user)
  const { toast, show: showToast } = useToast()
  const [studentCount, setStudentCount] = useState(0)
  const [courseCount, setCourseCount] = useState(0)
  const [sessionCount, setSessionCount] = useState(0)
  const [teachers, setTeachers] = useState<{ id: string; full_name: string | null; avatar_url: string | null; subjects: string[] }[]>([])
  const [studentSessions, setStudentSessions] = useState<StudentSession[]>([])
  const [enrolledCourseCount, setEnrolledCourseCount] = useState(0)
  const [activity, setActivity] = useState<ActivityItem[]>([])

  const creator = isCreatorRole(user?.role)
  const isAdmin = user?.role === 'admin'

  // If admin, render admin dashboard instead
  if (isAdmin) {
    return <AdminDashboard />
  }

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
      Promise.all([
        supabase.from('teacher_students')
          .upsert({ teacher_id: pendingTeacher, student_id: user.id }, { onConflict: 'teacher_id,student_id' }),
        supabase.from('profiles').update({ referred_by: pendingTeacher }).eq('id', user.id),
        supabase.from('referrals')
          .upsert({ referrer_id: pendingTeacher, referred_id: user.id }, { onConflict: 'referred_id' }),
      ]).catch(() => { /* ignore referral errors */ })
    } else if (pendingRef && pendingRef !== user.id) {
      localStorage.removeItem('classmeet_referrer')
      Promise.all([
        supabase.from('profiles').update({ referred_by: pendingRef }).eq('id', user.id),
        supabase.from('referrals')
          .upsert({ referrer_id: pendingRef, referred_id: user.id }, { onConflict: 'referred_id' }),
      ]).catch(() => { /* ignore referral errors */ })
    }

    // ── Load counts in parallel ──
    Promise.all([
      supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
      supabase.from('courses').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
      supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
    ]).then(([studentsRes, coursesRes, sessionsRes]) => {
      if (studentsRes.count !== null) setStudentCount(studentsRes.count)
      if (coursesRes.count !== null) setCourseCount(coursesRes.count)
      if (sessionsRes.count !== null) setSessionCount(sessionsRes.count)
    })

    const loadTargetedSessions = async () => {
      const { data: directTargets } = await supabase
        .from('session_targets')
        .select('session_id')
        .eq('target_type', 'student')
        .eq('target_id', user.id)

      const directIds = directTargets?.map(t => t.session_id) || []
      let allIds = [...new Set(directIds)]

      if (!isCreatorRole(user.role)) {
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

        allIds = [...new Set([...allIds, ...groupSessionIds])]
      }

      if (allIds.length === 0) {
        setStudentSessions([])
        return
      }

      const { data: sessions } = await supabase
        .from('sessions')
        .select('id, title, status, room_name, teacher_id, scheduled_at, started_at')
        .in('id', allIds)
        .in('status', ['live', 'scheduled'])
        .order('created_at', { ascending: false })

      if (sessions && sessions.length > 0) {
        const visible = sessions.filter(s => s.teacher_id !== user.id)
        if (visible.length === 0) {
          setStudentSessions([])
          return
        }

        const tIds = [...new Set(visible.map(s => s.teacher_id))]
        const { data: tProfiles } = await supabase
          .from('profiles')
          .select('id, full_name')
          .in('id', tIds)
        const nameMap = new Map(tProfiles?.map(p => [p.id, p.full_name]) || [])
        setStudentSessions(visible.map(s => ({ ...s, teacher_name: nameMap.get(s.teacher_id) || 'Teacher' })) as StudentSession[])
      } else {
        setStudentSessions([])
      }
    }

    // ── Load student's teachers + sessions ──
    if (!isCreatorRole(user.role)) {
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

      // Count courses accessible to this student (direct targets + via groups)
      const loadEnrolledCourses = async () => {
        const { data: directCourses } = await supabase
          .from('course_targets')
          .select('course_id')
          .eq('target_type', 'student')
          .eq('target_id', user.id)

        const { data: myGroups } = await supabase
          .from('group_members')
          .select('group_id')
          .eq('student_id', user.id)

        let groupCourseIds: string[] = []
        if (myGroups && myGroups.length > 0) {
          const gids = myGroups.map(g => g.group_id)
          const { data: groupCourses } = await supabase
            .from('course_targets')
            .select('course_id')
            .eq('target_type', 'group')
            .in('target_id', gids)
          if (groupCourses) groupCourseIds = groupCourses.map(c => c.course_id)
        }

        const directIds = directCourses?.map(c => c.course_id) ?? []
        const allIds = [...new Set([...directIds, ...groupCourseIds])]
        setEnrolledCourseCount(allIds.length)
      }
      loadEnrolledCourses()

      loadTargetedSessions()
    } else {
      loadTargetedSessions()
    }

    // ── Single consolidated real-time channel with debouncing ──
    let reloadTimer: ReturnType<typeof setTimeout> | null = null
    const debouncedSessionReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => loadTargetedSessions(), 500)
    }
    const debouncedCountReload = () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      reloadTimer = setTimeout(() => {
        Promise.all([
          supabase.from('teacher_students').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
          supabase.from('sessions').select('id', { count: 'exact', head: true }).eq('teacher_id', user.id),
        ]).then(([studentsRes, sessionsRes]) => {
          if (studentsRes.count !== null) setStudentCount(studentsRes.count)
          if (sessionsRes.count !== null) setSessionCount(sessionsRes.count)
        })
      }, 500)
    }

    const channel = supabase
      .channel('dashboard-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => {
        debouncedSessionReload()
        debouncedCountReload()
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_targets' }, debouncedSessionReload)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'teacher_students',
        filter: `teacher_id=eq.${user.id}`,
      }, debouncedCountReload)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'teacher_students',
        filter: `student_id=eq.${user.id}`,
      }, async () => {
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
      .subscribe()

    return () => {
      if (reloadTimer) clearTimeout(reloadTimer)
      supabase.removeChannel(channel)
    }
  }, [user?.id])

  // ── Load recent activity ──────────────────────────────────────────────────
  useEffect(() => {
    if (!user?.id) return
    const supabase = createClient()
    const items: ActivityItem[] = []

    async function loadActivity() {
      if (isCreatorRole(user!.role)) {
        // Teacher: recent sessions + courses + new students
        const [{ data: recentSessions }, { data: recentCourses }, { data: recentStudents }] = await Promise.all([
          supabase.from('sessions').select('id, title, status, created_at').eq('teacher_id', user!.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('courses').select('id, title, created_at').eq('teacher_id', user!.id).order('created_at', { ascending: false }).limit(5),
          supabase.from('teacher_students').select('student_id, created_at').eq('teacher_id', user!.id).order('created_at', { ascending: false }).limit(5),
        ])

        recentSessions?.forEach(s => items.push({
          id: `s-${s.id}`, type: 'session',
          title: s.status === 'ended' ? `Session ended: ${s.title}` : s.status === 'live' ? `Live now: ${s.title}` : `Scheduled: ${s.title}`,
          time: s.created_at, icon: Video, color: s.status === 'live' ? 'var(--success-400)' : 'var(--primary-400)',
        }))
        recentCourses?.forEach(c => items.push({
          id: `c-${c.id}`, type: 'course',
          title: `Course created: ${c.title}`,
          time: c.created_at, icon: BookOpen, color: 'var(--accent-400)',
        }))

        if (recentStudents && recentStudents.length > 0) {
          const sIds = recentStudents.map(s => s.student_id)
          const { data: profiles } = await supabase.from('profiles').select('id, full_name').in('id', sIds)
          const nameMap = new Map(profiles?.map(p => [p.id, p.full_name]) ?? [])
          recentStudents.forEach(s => items.push({
            id: `st-${s.student_id}`, type: 'student',
            title: `${nameMap.get(s.student_id) ?? 'A student'} joined`,
            time: s.created_at, icon: Users, color: 'var(--success-400)',
          }))
        }
      } else {
        // Student: sessions joined, courses enrolled
        const { data: recentSessions } = await supabase
          .from('session_targets').select('session_id, created_at')
          .eq('target_type', 'student').eq('target_id', user!.id)
          .order('created_at', { ascending: false }).limit(5)

        if (recentSessions && recentSessions.length > 0) {
          const sessIds = recentSessions.map(s => s.session_id)
          const { data: sessions } = await supabase.from('sessions').select('id, title').in('id', sessIds)
          const sessMap = new Map(sessions?.map(s => [s.id, s.title]) ?? [])
          recentSessions.forEach(s => items.push({
            id: `s-${s.session_id}`, type: 'session',
            title: `Invited to: ${sessMap.get(s.session_id) ?? 'Session'}`,
            time: s.created_at, icon: Video, color: 'var(--primary-400)',
          }))
        }

        const { data: recentCourses } = await supabase
          .from('course_targets').select('course_id, created_at')
          .eq('target_type', 'student').eq('target_id', user!.id)
          .order('created_at', { ascending: false }).limit(5)

        if (recentCourses && recentCourses.length > 0) {
          const cIds = recentCourses.map(c => c.course_id)
          const { data: courses } = await supabase.from('courses').select('id, title').in('id', cIds)
          const courseMap = new Map(courses?.map(c => [c.id, c.title]) ?? [])
          recentCourses.forEach(c => items.push({
            id: `c-${c.course_id}`, type: 'course',
            title: `Enrolled in: ${courseMap.get(c.course_id) ?? 'Course'}`,
            time: c.created_at, icon: BookOpen, color: 'var(--accent-400)',
          }))
        }
      }

      // Sort by time descending, take latest 8
      items.sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      setActivity(items.slice(0, 8))
    }

    loadActivity()
  }, [user?.id])

  const userPerms = (user?.permissions ?? []) as TeacherPermissionKey[]
  const allActions = creator ? TEACHER_ACTIONS : STUDENT_ACTIONS
  const actions = allActions.filter(a => !a.permissionCheck || a.permissionCheck(userPerms))

  function handleAction(action: Action) {
    if (action.comingSoon) {
      showToast(`✨ ${action.label} — coming soon!`)
    } else if (action.href) {
      router.push(`${basePath}/${action.href}`)
    }
  }

  return (
    <div style={{ maxWidth: '960px' }}>

      {/* ── My Teachers (students only) ───────────────────────────────── */}
      {!creator && teachers.length > 0 && (
        <div className="card stagger-item" style={{ marginBottom: '24px', padding: '20px' }}>
          <h3 style={{ margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <GraduationCap size={15} />
            {teachers.length === 1 ? 'My Teacher' : 'My Teachers'}
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
            {teachers.map(t => (
              <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)', padding: '10px 14px', border: '1px solid var(--border-primary)' }}>
                <Avatar src={t.avatar_url} name={t.full_name} size="sm" />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{t.full_name || 'Teacher'}</div>
                  {t.subjects && t.subjects.length > 0 && (
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>{t.subjects.slice(0, 3).join(', ')}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Live & Upcoming Sessions (targeted users) ─────────────────── */}
      {studentSessions.length > 0 && (
        <div className="card stagger-item" style={{ marginBottom: '24px', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Radio size={16} color="var(--danger-400)" />
              <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
                {creator ? 'Sessions Targeted To You' : 'Live & Upcoming Sessions'}
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
            <Button variant="ghost" size="sm" onClick={() => router.push(`${basePath}/rooms`)}>
              View all <ArrowRight size={12} />
            </Button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '12px' }}>
            {studentSessions.slice(0, 6).map(s => (
              <DashSessionCard
                key={s.id}
                session={s}
                onJoin={() => router.push(`${basePath}/rooms/${encodeURIComponent(s.room_name)}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Quick Actions
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {actions.map((action, i) => {
          const Icon = action.icon
          
          // Get stat value for this action
          let statValue = ''
          if (action.statKey === 'sessionCount') statValue = String(sessionCount)
          if (action.statKey === 'courseCount') statValue = String(courseCount)
          if (action.statKey === 'studentCount') statValue = String(studentCount)
          if (action.statKey === 'sessionsJoined') statValue = String(studentSessions.length)
          if (action.statKey === 'enrolledCourseCount') statValue = String(enrolledCourseCount)
          
          return (
            <div
              key={action.label}
              className="card card-interactive dash-action-card stagger-item"
              style={{ animationDelay: `${i * 60}ms`, padding: '20px', cursor: 'pointer', position: 'relative', display: 'flex', flexDirection: 'column' }}
              role="button"
              tabIndex={0}
              onClick={() => handleAction(action)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && handleAction(action)}
            >
              {/* Stat badge in top right */}
              {statValue && (
                <div style={{ position: 'absolute', top: '12px', right: '12px', textAlign: 'right' }}>
                  {(action.statKey === 'sessionCount' || action.statKey === 'sessionsJoined') ? (
                    // Live/Active sessions - Green with animation
                    <div style={{ 
                      fontSize: '1.8rem', 
                      fontWeight: 700, 
                      color: '#22c55e',
                      lineHeight: 1,
                      textShadow: '0 0 12px rgba(34, 197, 94, 0.4)',
                      animation: 'pulse-glow 2s ease-in-out infinite',
                      letterSpacing: '-0.02em'
                    }}>
                      {statValue}
                    </div>
                  ) : (
                    // Other stats - default color
                    <div style={{ fontSize: '1.5rem', fontWeight: 700, color: action.color, lineHeight: 1 }}>{statValue}</div>
                  )}
                </div>
              )}
              
              <div className="dash-action-icon" style={{ width: 44, height: 44, borderRadius: 'var(--radius-lg)', background: `color-mix(in srgb, ${action.color} 15%, transparent)`, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '12px' }}>
                <Icon size={20} color={action.color} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px', flex: 1 }}>
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

      {/* ── Recent Activity ─────────────────────────────────────────────── */}
      <h3 style={{ fontSize: '0.85rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '12px' }}>
        Recent Activity
      </h3>
      {activity.length === 0 ? (
        <div className="card stagger-item" style={{ animationDelay: '420ms', padding: '40px', textAlign: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--bg-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <Clock size={24} color="var(--text-muted)" />
          </div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>No activity yet</div>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
            {creator
              ? 'Start a live room, create a course, or invite students to see activity here.'
              : 'Join sessions and enroll in courses to see your activity here.'}
          </p>
        </div>
      ) : (
        <div className="card stagger-item" style={{ animationDelay: '420ms', padding: '0', overflow: 'hidden' }}>
          {activity.map((item, i) => {
            const Icon = item.icon
            const timeAgo = formatTimeAgo(item.time)
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: '12px',
                  padding: '14px 20px',
                  borderBottom: i < activity.length - 1 ? '1px solid var(--border-subtle)' : 'none',
                }}
              >
                <div style={{
                  width: 32, height: 32, borderRadius: 'var(--radius-md)',
                  background: `color-mix(in srgb, ${item.color} 15%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={15} color={item.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.title}
                  </div>
                </div>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-disabled)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {timeAgo}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toast && (
        <div className="toast toast-info" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
