'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import { UserPlus, ArrowRight, AlertCircle, CheckCircle, RefreshCw } from 'lucide-react'
import type { UserRole } from '@/lib/supabase/types'

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
  | 'choose-role'
  | 'joining'
  | 'success'
  | 'error'
  | 'invalid-teacher'

const ROLE_OPTIONS: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'teacher', label: 'Teacher', emoji: '🎓', desc: 'I host live classes and create content' },
  { value: 'student', label: 'Student', emoji: '📚', desc: 'I attend classes and learn from teachers' },
]

export default function InvitePage() {
  const params    = useParams()
  const router    = useRouter()
  const user      = useAppStore((s) => s.user)
  const teacherId = params.teacherId as string

  const [state,        setState]        = useState<InviteState>('loading')
  const [teacher,      setTeacher]      = useState<TeacherProfile | null>(null)
  const [errorMsg,     setErrorMsg]     = useState('')
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null)

  useEffect(() => {
    if (!teacherId) return
    const supabase = createClient()

    async function resolve() {
      // 1. Fetch the teacher's public profile
      const { data: rpcData } = await supabase
        .rpc('get_invite_profile', { teacher_id: teacherId })
      const teacherProfile = Array.isArray(rpcData) ? rpcData[0] : rpcData
      if (!teacherProfile) { setState('invalid-teacher'); return }
      setTeacher(teacherProfile)

      // 2. Check if visitor is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { setState('not-logged-in'); return }

      // 3. Prevent self-join
      if (authUser.id === teacherId) { setState('self'); return }

      // 4. Load visitor's profile — pre-select their existing role if they have one
      const { data: visitorProfile } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authUser.id)
        .single()

      if (visitorProfile?.role) {
        setSelectedRole(visitorProfile.role as UserRole)
      }

      // 5. Already connected? Check both directions (teacher↔student and student↔teacher)
      const [{ data: asStudent }, { data: asTeacher }] = await Promise.all([
        supabase.from('teacher_students').select('id')
          .eq('teacher_id', teacherId).eq('student_id', authUser.id).maybeSingle(),
        supabase.from('teacher_students').select('id')
          .eq('teacher_id', authUser.id).eq('student_id', teacherId).maybeSingle(),
      ])
      if (asStudent || asTeacher) { setState('already-connected'); return }

      setState('choose-role')
    }

    resolve()
  }, [teacherId])

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

  async function handleJoin() {
    if (!user?.id || !selectedRole) return
    setState('joining')

    const supabase = createClient()

    // Step 1 — always set the chosen role explicitly so RLS has a valid profile.
    // Use update (not upsert) — the profile row already exists from the invite trigger,
    // and upsert would trigger the INSERT policy (which blocks direct user inserts).
    const { error: profileError } = await supabase
      .from('profiles')
      .update({ role: selectedRole, onboarding_complete: true, updated_at: new Date().toISOString() })
      .eq('id', user.id)
    if (profileError) {
      setErrorMsg(profileError.message)
      setState('error')
      return
    }

    // Step 2 — single row: teacher_id = page owner, student_id = current user.
    // The sidebar queries both directions so one row covers both parties.
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

    // Step 3 — referral tracking for students only
    if (selectedRole === 'student') {
      await supabase.from('profiles').update({ referred_by: teacherId }).eq('id', user.id)
      await supabase.from('referrals')
        .upsert({ referrer_id: teacherId, referred_id: user.id }, { onConflict: 'referred_id' })
    }

    setState('success')
  }

  function goToDashboard() { router.push('/dashboard') }

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
        maxWidth: '440px',
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
            <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.9rem' }}>Loading invite…</p>
          </div>
        )}

        {/* Invalid */}
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

        {/* Self */}
        {state === 'self' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>That&#39;s You!</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              You can&#39;t join yourself. Share this link with others instead.
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
              You&#39;re already connected with <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>.
            </p>
            <Button onClick={goToDashboard} style={{ width: '100%' }}>Go to Dashboard</Button>
          </div>
        )}

        {/* Choose role — always shown, pre-filled with existing role if any */}
        {state === 'choose-role' && teacher && (
          <div>
            <Avatar src={teacher.avatar_url} name={teacher.full_name} size="xl" />
            <h2 style={{ margin: '16px 0 6px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              {teacherName} invited you!
            </h2>
            {teacher.subjects && teacher.subjects.length > 0 && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '4px' }}>
                Teaches: {teacher.subjects.slice(0, 4).join(', ')}
              </p>
            )}
            <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: '20px' }}>
              How are you joining ClassMeet?
            </p>

            {/* Role picker */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '16px' }}>
              {ROLE_OPTIONS.map((r) => (
                <div
                  key={r.value}
                  className={`role-card${selectedRole === r.value ? ' selected' : ''}`}
                  onClick={() => setSelectedRole(r.value)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && setSelectedRole(r.value)}
                >
                  <div className="role-card-icon">{r.emoji}</div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{r.label}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>{r.desc}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Contextual hint based on chosen role */}
            {selectedRole && (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginBottom: '16px', fontStyle: 'italic' }}>
                {selectedRole === 'teacher'
                  ? `You'll collaborate with ${teacherName} as a co-teacher.`
                  : `You'll join ${teacherName}'s classroom as a student.`
                }
              </p>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <Button variant="outline" onClick={goToDashboard} style={{ flex: 1 }}>Cancel</Button>
              <Button onClick={handleJoin} disabled={!selectedRole} style={{ flex: 1 }}>
                <UserPlus size={16} />
                {selectedRole === 'teacher' ? 'Collaborate' : selectedRole === 'student' ? 'Join Classroom' : 'Continue'}
              </Button>
            </div>
          </div>
        )}

        {/* Joining */}
        {state === 'joining' && (
          <div style={{ padding: '40px 0' }}>
            <RefreshCw size={32} color="var(--primary-400)" style={{ animation: 'spin 1s linear infinite' }} />
            <p style={{ color: 'var(--text-muted)', marginTop: '12px', fontSize: '0.9rem' }}>
              Connecting you to {teacherName}…
            </p>
          </div>
        )}

        {/* Success */}
        {state === 'success' && teacher && (
          <div>
            <CheckCircle size={48} color="var(--success-400)" />
            <h2 style={{ margin: '16px 0 8px', color: 'var(--text-primary)', fontSize: '1.2rem' }}>
              {selectedRole === 'teacher' ? 'Collaboration Started!' : 'Welcome to ClassMeet!'}
            </h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '24px' }}>
              {selectedRole === 'teacher'
                ? <>You&#39;re now collaborating with <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>.</>
                : <>You&#39;re now a student of <strong style={{ color: 'var(--text-primary)' }}>{teacherName}</strong>.</>
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
              <Button onClick={() => setState('choose-role')} style={{ flex: 1 }}>Try Again</Button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
