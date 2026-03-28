'use client'

import { useEffect, useState } from 'react'
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
  const [checking, setChecking] = useState(true)

  // Check if user is already onboarded, if so redirect them
  useEffect(() => {
    const checkOnboarding = async () => {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setChecking(false)
        return
      }

      const { data: profile } = await supabase
        .from('profiles')
        .select('onboarding_complete, is_super_admin, school_id, role')
        .eq('id', user.id)
        .single()

      const p = profile as any

      // Super admin → redirect to /superadmin
      if (p?.is_super_admin) {
        router.push('/superadmin')
        return
      }

      // Already onboarded → redirect to their school/dashboard
      if (p?.onboarding_complete) {
        if (p?.school_id) {
          const { data: school } = await supabase
            .from('schools')
            .select('slug')
            .eq('id', p.school_id)
            .single()
          if (school) {
            const roleRoute = p.role === 'admin' ? 'admin' : p.role === 'teacher' ? 'teacher' : 'student'
            router.push(`/${school.slug}/${roleRoute}`)
            return
          }
        }
        router.push('/dashboard')
        return
      }

      setChecking(false)
    }

    checkOnboarding()
  }, [router])

  async function handleFinish() {
    if (!role) return
    setLoading(true)
    const supabase = createClient()
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) { router.push('/sign-in'); return }

    // Check if user is the designated super admin
    let finalRole = role
    let isSuperAdmin = false

    try {
      const { data: settings } = await (supabase as any)
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'super_admin_email')
        .single()

      const superAdminEmail = settings?.setting_value?.email
      if (superAdminEmail && authUser.email?.toLowerCase() === superAdminEmail.toLowerCase()) {
        finalRole = 'super_admin'
        isSuperAdmin = true
      }
    } catch {
      // If settings lookup fails, just use the selected role
    }

    // For school admins, redirect to school registration
    if (finalRole === 'admin') {
      router.push('/register-school')
      return
    }

    // For super_admin/teacher/student, save role and redirect
    await supabase.from('profiles').upsert({
      id: authUser.id,
      role: finalRole,
      is_super_admin: isSuperAdmin,
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
      role: finalRole,
      onboardingComplete: true,
      schoolId: null,
      schoolSlug: null,
      isSuperAdmin,
    })

    // Super admin goes to /superadmin, others go to /dashboard
    router.push(isSuperAdmin ? '/superadmin' : '/dashboard')
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
      ) : (
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
      )}
    </div>
  )
}

