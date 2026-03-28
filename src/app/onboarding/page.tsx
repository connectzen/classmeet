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
  { value: 'admin', label: 'School Admin', emoji: '🏫', desc: 'I manage a school and its users' },
]

export default function OnboardingPage() {
  const router = useRouter()
  const setUser = useAppStore((s) => s.setUser)

  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleFinish() {
    if (!role) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/sign-in'); return }

    // For school admins, redirect to school registration
    if (role === 'admin') {
      router.push('/register-school')
      return
    }

    // For teacher/student, save role and redirect to dashboard
    await supabase.from('profiles').upsert({
      id: authUser.id,
      role,
      goals: [],
      subjects: [],
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
      schoolId: null,
      schoolSlug: null,
      isSuperAdmin: false,
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
          onClick={handleFinish}
          disabled={!role}
          loading={loading}
          style={{ width: '100%', marginTop: '24px' }}
        >
          Get Started
        </Button>
      </div>
    </div>
  )
}

