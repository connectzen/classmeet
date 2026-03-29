'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import type { UserRole, TeacherType } from '@/lib/supabase/types'
import Button from '@/components/ui/Button'
import { Video, ArrowLeft } from 'lucide-react'
import { resolveUserDestination } from '@/lib/routing/user-destination'

const ROLES: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'teacher', label: 'Teacher', emoji: '🎓', desc: 'I host live classes and create content' },
  { value: 'student', label: 'Student', emoji: '📚', desc: 'I attend classes and learn from teachers' },
  { value: 'admin', label: 'School Admin', emoji: '🏫', desc: 'I manage a school and its users' },
]

const TEACHER_TYPES: { value: TeacherType; label: string; emoji: string; desc: string }[] = [
  { value: 'independent', label: 'Independent Teacher', emoji: '🚀', desc: 'I manage my own classroom, students, and branding' },
  { value: 'school_employed', label: 'School Teacher', emoji: '🏫', desc: 'I belong to a school and will be assigned classes' },
]

type Step = 'role' | 'teacher-type'

export default function OnboardingPage() {
  const router = useRouter()
  const setUser = useAppStore((s) => s.setUser)

  const [step, setStep] = useState<Step>('role')
  const [role, setRole] = useState<UserRole | null>(null)
  const [teacherType, setTeacherType] = useState<TeacherType | null>(null)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)

  // Check if user is already onboarded, if so redirect them
  useEffect(() => {
    let mounted = true
    const checkOnboarding = async () => {
      const supabase = createClient()
      try {
        const timeoutMs = 8000
        const timeout = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('User lookup timed out')), timeoutMs)
        })

        const userResult = await Promise.race([supabase.auth.getUser(), timeout]) as Awaited<ReturnType<typeof supabase.auth.getUser>>
        const user = userResult.data.user

        if (!user) {
          router.replace('/sign-in')
          return
        }

        const profileResult = await Promise.race([
          supabase
            .from('profiles')
            .select('role, is_super_admin, school_id')
            .eq('id', user.id)
            .single(),
          timeout,
        ]) as any

        const profile = profileResult.data as any

        if (profile?.school_id) {
          const schoolResult = await supabase
            .from('schools')
            .select('slug')
            .eq('id', profile.school_id)
            .single()

          const schoolSlug = schoolResult.data?.slug ?? null
          const destination = resolveUserDestination(profile, schoolSlug)
          if (destination !== '/onboarding') {
            router.replace(destination)
            return
          }
        } else {
          const destination = resolveUserDestination(profile, null)
          if (destination !== '/onboarding') {
            router.replace(destination)
            return
          }
        }

        if (mounted) {
          setChecking(false)
          setCheckError(null)
        }
      } catch {
        if (mounted) {
          setCheckError('We could not load your account. Redirecting to sign in...')
          setChecking(false)
        }
        router.replace('/sign-in')
      }
    }

    checkOnboarding()

    return () => {
      mounted = false
    }
  }, [router])

  function handleRoleNext() {
    if (!role) return
    if (role === 'teacher') {
      setStep('teacher-type')
    } else {
      handleFinish()
    }
  }

  async function handleFinish() {
    if (!role) return
    if (role === 'teacher' && !teacherType) return
    setLoading(true)
    setSubmitError(null)

    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) {
      setLoading(false)
      setSubmitError('Your session expired. Please sign in again.')
      router.replace('/sign-in')
      return
    }

    try {
      const response = await fetch('/api/onboarding', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role, teacherType: role === 'teacher' ? teacherType : undefined }),
      })

      const payload = await response.json()
      if (!response.ok) {
        throw new Error(payload?.error || 'Could not save your role.')
      }

      setUser({
        id: authUser.id,
        email: authUser.email ?? '',
        fullName: authUser.user_metadata?.full_name ?? '',
        avatarUrl: null,
        role: payload.data.role,
        onboardingComplete: true,
        schoolId: payload.data.schoolId ?? null,
        schoolSlug: null,
        isSuperAdmin: payload.data.isSuperAdmin ?? false,
        teacherType: payload.data.teacherType ?? null,
        workspaceSlug: null,
        permissions: [],
      })

      router.replace(payload.data.destination)
      router.refresh()
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Could not save your role.')
      setLoading(false)
    }
  }

  return (
    <div className="onboard-page">
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
        <div className="auth-logo-icon" style={{ width: 36, height: 36 }}>
          <Video size={20} color="#fff" />
        </div>
        <span className="auth-logo-name">ClassMeet</span>
      </div>

      {checking ? (
        <div className="onboard-card animate-slide-up">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      ) : step === 'role' ? (
        <div className="onboard-card animate-slide-up">
          {checkError && (
            <p style={{ color: 'var(--error-400)', marginBottom: '12px', fontSize: '0.85rem' }}>{checkError}</p>
          )}
          {submitError && (
            <p style={{ color: 'var(--error-400)', marginBottom: '12px', fontSize: '0.85rem' }}>{submitError}</p>
          )}
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Who are you?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Choose your role to get started.</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '12px' }}>
            {ROLES.map((r) => (
              <div
                key={r.value}
                className={`role-card ${role === r.value ? 'selected' : ''}`}
                onClick={() => setRole(r.value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setRole(r.value)}
              >
                <div className="role-card-icon">{r.emoji}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{r.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{r.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={handleRoleNext}
            disabled={!role}
            loading={role !== 'teacher' && loading}
            style={{ width: '100%', marginTop: '24px' }}
          >
            {role === 'teacher' ? 'Next' : 'Get Started'}
          </Button>
        </div>
      ) : (
        <div className="onboard-card animate-slide-up">
          {submitError && (
            <p style={{ color: 'var(--error-400)', marginBottom: '12px', fontSize: '0.85rem' }}>{submitError}</p>
          )}
          <button
            onClick={() => { setStep('role'); setTeacherType(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: 0, marginBottom: '16px', fontSize: '0.85rem' }}
          >
            <ArrowLeft size={16} /> Back
          </button>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>How will you teach?</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Tell us about your teaching setup.</p>
          <div style={{ display: 'grid', gap: '12px' }}>
            {TEACHER_TYPES.map((t) => (
              <div
                key={t.value}
                className={`role-card ${teacherType === t.value ? 'selected' : ''}`}
                onClick={() => setTeacherType(t.value)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setTeacherType(t.value)}
              >
                <div className="role-card-icon">{t.emoji}</div>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{t.label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>{t.desc}</div>
                </div>
              </div>
            ))}
          </div>
          <Button
            onClick={handleFinish}
            disabled={!teacherType}
            loading={loading}
            style={{ width: '100%', marginTop: '24px' }}
          >
            Get Started
          </Button>
        </div>
      )}
    </div>
  )
}
