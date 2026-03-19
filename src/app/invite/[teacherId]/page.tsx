'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { UserPlus, ArrowRight, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'

interface TeacherProfile {
  id: string
  full_name: string | null
  avatar_url: string | null
  subjects: string[] | null
}

type InviteState =
  | 'loading'
  | 'not-logged-in'
  | 'self'
  | 'already-connected'
  | 'confirm-join'
  | 'confirm-collab'
  | 'confirm-switch'
  | 'joining'
  | 'success'
  | 'error'
  | 'invalid-teacher'

export default function InvitePage() {
  const params = useParams()
  const router = useRouter()
  const user = useAppStore((s) => s.user)
  const teacherId = params.teacherId as string

  const [state, setState] = useState<InviteState>('loading')
  const [teacher, setTeacher] = useState<TeacherProfile | null>(null)
  const [existingTeachers, setExistingTeachers] = useState<TeacherProfile[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [visitorIsTeacher, setVisitorIsTeacher] = useState(false)

  // Resolve teacher profile + determine state
  useEffect(() => {
    if (!teacherId) return
    const supabase = createClient()

    async function resolve() {
      // 1. Fetch the teacher's profile via RPC (bypasses RLS for public invite info)
      const { data: rpcData } = await supabase
        .rpc('get_invite_profile', { teacher_id: teacherId })

      const teacherProfile = Array.isArray(rpcData) ? rpcData[0] : rpcData

      if (!teacherProfile) {
        setState('invalid-teacher')
        return
      }
      setTeacher(teacherProfile)

      // 2. Check if user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) {
        setState('not-logged-in')
        return
      }

      // 3. If user is the teacher themselves
      if (authUser.id === teacherId) {
        setState('self')
        return
      }

      // 4. Fetch visitor's own profile to know their role
      const { data: visitorProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single()
      const isTeacher = visitorProfile?.role === 'teacher'
      setVisitorIsTeacher(isTeacher)

      // 5. Check existing connection to THIS teacher
      const { data: existing } = await supabase
        .from('teacher_students')
        .select('id')
        .eq('teacher_id', teacherId)
        .eq('student_id', authUser.id)
        .maybeSingle()

      if (existing) {
        setState('already-connected')
        return
      }

      // 6. Teacher-to-teacher: skip the "switch" flow, just confirm collab
      if (isTeacher) {
        setState('confirm-collab')
        return
      }

      // 7. Check if student is connected to OTHER teachers
      const { data: otherEnrollments } = await supabase
        .from('teacher_students')
        .select('teacher_id')
        .eq('student_id', authUser.id)

      if (otherEnrollments && otherEnrollments.length > 0) {
        const teacherIds = otherEnrollments.map((e) => e.teacher_id)
        const { data: teacherProfiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, subjects')
          .in('id', teacherIds)
        setExistingTeachers(teacherProfiles ?? [])
        setState('confirm-switch')
      } else {
        setState('confirm-join')
      }
    }

    resolve()
  }, [teacherId])

  // --- Not logged in: store teacher ID and redirect to sign-up ---
  function handleRedirectSignUp() {
    localStorage.setItem('classmeet_teacher_id', teacherId)
    localStorage.setItem('classmeet_referrer', teacherId)
    router.push(`/sign-up?ref=${teacherId}`)
  }

  function handleRedirectSignIn() {
    localStorage.setItem('classmeet_teacher_id', teacherId)
    localStorage.setItem('classmeet_referrer', teacherId)
    router.push(`/sign-in?ref=${teacherId}`)
  }

  // --- Join teacher (new or switch) ---
  async function handleJoin() {
    if (!user?.id) return
    setState('joining')

    const supabase = createClient()

    const { error } = await supabase
      .from('teacher_students')
      .upsert(
        { teacher_id: teacherId, student_id: user.id },
        { onConflict: 'teacher_id,student_id' }
      )

    if (error) {
      setErrorMsg(error.message)
      setState('error')
      return
    }

    // Also update legacy referral tracking
    await supabase.from('profiles').update({ referred_by: teacherId }).eq('id', user.id)
    await supabase.from('referrals')
      .upsert({ referrer_id: teacherId, referred_id: user.id }, { onConflict: 'referred_id' })

    setState('success')
  }

  function goToDashboard() {
    router.push('/dashboard')
  }

  // ── Render ──────────────────────────────────────────────────────────────────
  const teacherName = teacher?.full_name || 'This teacher'

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-primary)',
      padding: '20px',
    }}>
      <div style={{
        width: '100%',
        maxWidth: '420px',
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border-primary)',
        borderRadius: 'var(--radius-xl)',
        padding: '32px',
        textAlign: 'center',
      }}>
        {/* Loading */}
        {state === 'loading' && (
          <div style={{ padding: '40px 0' }}>
            <RefreshCw size={32} color="var(--text-muted)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.9rem' }}>Loading invite...</p>
          </div>
        )}

        {/* Invalid teacher */}
        {state === 'invalid-teacher' && (
          <div>
            <AlertCircle size={40} color="var(--error-400)" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>Invalid Invite Link</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              This invite link is no longer valid or the teacher account doesn&#39;t exist.
            </p>
            <Button onClick={goToDashboard} style={{ width: '100%' }}>Go to Dashboard</Button>
          </div>
        )}

        {/* Self link */}
        {state === 'self' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>That&#39;s You!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              You can&#39;t join yourself as a student. Share this link with your students instead.
            </p>
            <Button onClick={goToDashboard} style={{ width: '100%' }}>Go to Dashboard</Button>
          </div>
        )}

        {/* Not logged in */}
        {state === 'not-logged-in' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              {teacherName} invited you!
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              Join <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>&#39;s classroom on ClassMeet.
            </p>
            {teacher.subjects && teacher.subjects.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '24px' }}>
                Teaches: {teacher.subjects.slice(0, 4).join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <Button onClick={handleRedirectSignUp} style={{ width: '100%' }}>
                <UserPlus size={16} /> Create Account &amp; Join
              </Button>
              <Button variant="outline" onClick={handleRedirectSignIn} style={{ width: '100%' }}>
                Sign In &amp; Join
              </Button>
            </div>
          </div>
        )}

        {/* Already connected */}
        {state === 'already-connected' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <CheckCircle size={28} color="var(--success-400)" style={{ marginTop: '12px' }} />
            <h2 style={{ margin: '12px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>Already Connected</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {visitorIsTeacher
                ? <>You&#39;re already collaborating with <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>.</>
                : <>You&#39;re already a student of <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>.</>
              }
            </p>
            <Button onClick={goToDashboard} style={{ width: '100%' }}>Go to Dashboard</Button>
          </div>
        )}

        {/* Confirm join (no existing teachers) */}
        {state === 'confirm-join' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              Join {teacherName}?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '8px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong> has invited you to become their student.
            </p>
            {teacher.subjects && teacher.subjects.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '24px' }}>
                Teaches: {teacher.subjects.slice(0, 4).join(', ')}
              </p>
            )}
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="outline" onClick={goToDashboard} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleJoin} style={{ flex: 1 }}>
                <UserPlus size={16} /> Join Teacher
              </Button>
            </div>
          </div>
        )}

        {/* Confirm collab (visitor is a teacher) */}
        {state === 'confirm-collab' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              Collaborate with {teacherName}?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              Connect with <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong> as a collaboration teacher. You&#39;ll appear in each other&#39;s sidebar.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="outline" onClick={goToDashboard} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleJoin} style={{ flex: 1 }}>
                <UserPlus size={16} /> Collaborate
              </Button>
            </div>
          </div>
        )}

        {/* Confirm switch (has existing teachers) */}
        {state === 'confirm-switch' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              Join {teacherName}?
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '12px' }}>
              <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong> has invited you to become their student.
            </p>
            <div style={{
              background: 'var(--bg-tertiary)',
              borderRadius: 'var(--radius-md)',
              padding: '12px',
              marginBottom: '20px',
              border: '1px solid var(--border-primary)',
            }}>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                You&#39;re currently connected to:
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {existingTeachers.map((t) => (
                  <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Avatar src={t.avatar_url} name={t.full_name} size="xs" />
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                      {t.full_name || 'Teacher'}
                    </span>
                  </div>
                ))}
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: '8px 0 0', fontStyle: 'italic' }}>
                You&#39;ll keep all existing connections. This will add a new teacher.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="outline" onClick={goToDashboard} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleJoin} style={{ flex: 1 }}>
                <UserPlus size={16} /> Join Teacher
              </Button>
            </div>
          </div>
        )}

        {/* Joining */}
        {state === 'joining' && (
          <div style={{ padding: '40px 0' }}>
            <RefreshCw size={32} color="var(--primary-400)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.9rem' }}>Connecting you to {teacherName}...</p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && teacher && (
          <div>
            <CheckCircle size={48} color="var(--success-400)" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              {visitorIsTeacher ? 'Collaboration Started!' : 'Connected!'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {visitorIsTeacher
                ? <>You&#39;re now collaborating with <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>. You&#39;ll appear in each other&#39;s sidebar.</>
                : <>You&#39;re now a student of <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>. You can see their sessions on your dashboard.</>
              }
            </p>
            <Button onClick={goToDashboard} style={{ width: '100%' }}>
              Go to Dashboard <ArrowRight size={16} />
            </Button>
          </div>
        )}

        {/* Error */}
        {state === 'error' && (
          <div>
            <AlertCircle size={40} color="var(--error-400)" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>Something went wrong</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {errorMsg || 'Could not connect to this teacher. Please try again.'}
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="outline" onClick={goToDashboard} style={{ flex: 1 }}>Dashboard</Button>
              <Button onClick={() => setState('confirm-join')} style={{ flex: 1 }}>Try Again</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
