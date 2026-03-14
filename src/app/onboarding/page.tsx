'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import type { UserRole } from '@/lib/supabase/types'
import Button from '@/components/ui/Button'
import { Video } from 'lucide-react'

const ROLES: { value: UserRole; label: string; emoji: string; desc: string }[] = [
  { value: 'teacher', label: 'Teacher', emoji: '🎓', desc: 'I host live classes and create content' },
  { value: 'student', label: 'Student', emoji: '📚', desc: 'I attend classes and learn from teachers' },
  { value: 'member', label: 'Organization', emoji: '🏢', desc: 'I manage teachers and students' },
  { value: 'guest', label: 'Just Exploring', emoji: '👀', desc: 'I want to see what ClassMeet offers' },
]

const GOALS = [
  { id: 'live', label: 'Live Teaching', icon: '📡' },
  { id: 'quizzes', label: 'Quizzes & Assessments', icon: '✍️' },
  { id: 'courses', label: 'Course Creation', icon: '📖' },
  { id: 'collab', label: 'Collaboration', icon: '🤝' },
  { id: 'records', label: 'Session Recording', icon: '🎬' },
  { id: 'analytics', label: 'Analytics', icon: '📊' },
]

const SUBJECTS = [
  'Mathematics', 'Science', 'Language Arts', 'History', 'Computer Science',
  'Physics', 'Chemistry', 'Biology', 'Arts', 'Music', 'Physical Education',
  'Economics', 'Psychology', 'Philosophy', 'Foreign Languages', 'Engineering',
]

export default function OnboardingPage() {
  const router = useRouter()
  const setUser = useAppStore((s) => s.setUser)
  const user = useAppStore((s) => s.user)

  const [step, setStep] = useState(0)
  const [role, setRole] = useState<UserRole | null>(null)
  const [goals, setGoals] = useState<string[]>([])
  const [subjects, setSubjects] = useState<string[]>([])
  const [loading, setLoading] = useState(false)

  const totalSteps = 3

  function toggleGoal(id: string) {
    setGoals((g) => g.includes(id) ? g.filter((x) => x !== id) : [...g, id])
  }

  function toggleSubject(s: string) {
    setSubjects((arr) => arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s])
  }

  async function handleFinish() {
    if (!role) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/sign-in'); return }

    await supabase.from('profiles').upsert({
      id: authUser.id,
      role,
      goals,
      subjects,
      onboarding_complete: true,
      updated_at: new Date().toISOString(),
    })

    setUser({
      id: authUser.id,
      email: authUser.email ?? '',
      fullName: authUser.user_metadata?.full_name ?? '',
      avatarUrl: null,
      role,
      onboardingComplete: true,
    })

    router.push('/dashboard')
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

      <div className="onboard-card animate-slide-up">
        {/* Progress */}
        <div style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Step {step + 1} of {totalSteps}</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{Math.round(((step + 1) / totalSteps) * 100)}%</span>
          </div>
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${((step + 1) / totalSteps) * 100}%` }} />
          </div>
        </div>

        {step === 0 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>What describes you best?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>This helps us personalize your experience.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
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
              onClick={() => setStep(1)}
              disabled={!role}
              style={{ width: '100%', marginTop: '24px' }}
            >
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>What are you here for?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Choose all that apply.</p>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              {GOALS.map((g, i) => (
                <div
                  key={g.id}
                  className={`stagger-item card card-interactive ${goals.includes(g.id) ? 'selected' : ''}`}
                  style={{ animationDelay: `${i * 60}ms`, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}
                  onClick={() => toggleGoal(g.id)}
                  role="checkbox"
                  aria-checked={goals.includes(g.id)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleGoal(g.id)}
                >
                  <span style={{ fontSize: '1.4rem' }}>{g.icon}</span>
                  <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)' }}>{g.label}</span>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button variant="ghost" onClick={() => setStep(0)} style={{ flex: 1 }}>Back</Button>
              <Button onClick={() => setStep(2)} style={{ flex: 2 }}>Continue</Button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>What subjects interest you?</h2>
            <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>Pick as many as you like.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {SUBJECTS.map((s) => (
                <span
                  key={s}
                  className={`pill-tag ${subjects.includes(s) ? 'selected' : ''}`}
                  onClick={() => toggleSubject(s)}
                  role="checkbox"
                  aria-checked={subjects.includes(s)}
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && toggleSubject(s)}
                >
                  {s}
                </span>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <Button variant="ghost" onClick={() => setStep(1)} style={{ flex: 1 }}>Back</Button>
              <Button onClick={handleFinish} loading={loading} style={{ flex: 2 }}>
                Go to dashboard
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

