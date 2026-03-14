'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SignUpPage() {
  return <Suspense><SignUpPageInner /></Suspense>
}

function SignUpPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const referrerId = searchParams.get('ref') // capture ?ref= from sharing link
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function validate() {
    if (!fullName.trim()) return 'Full name is required.'
    if (!email.trim()) return 'Email is required.'
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return null
  }

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setError(null)
    setLoading(true)

    // Persist referrer in localStorage so it survives the email redirect
    if (referrerId) {
      localStorage.setItem('classmeet_referrer', referrerId)
      localStorage.setItem('classmeet_teacher_id', referrerId) // teacher-student link
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          ...(referrerId ? { referred_by: referrerId } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push(`/verify-email?email=${encodeURIComponent(email)}`)
  }

  const pwStrength = password.length === 0 ? 0
    : password.length < 6 ? 1
    : password.length < 10 ? 2
    : /[A-Z]/.test(password) && /[0-9]/.test(password) ? 4 : 3

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', 'var(--error-400)', 'var(--warning-400)', 'var(--info-400)', 'var(--success-400)']

  return (
    <AuthCard title="Create your account" subtitle="Join ClassMeet for free">
      <form onSubmit={handleSignUp} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Full name"
            type="text"
            placeholder="Jane Smith"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            leftIcon={<User size={16} />}
            required
            autoComplete="name"
          />

          <Input
            label="Email address"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              rightIcon={showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightIconClick={() => setShowPw((v) => !v)}
              required
              autoComplete="new-password"
            />
            {password && (
              <div style={{ marginTop: '8px' }}>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${(pwStrength / 4) * 100}%`,
                      background: strengthColor[pwStrength],
                    }}
                  />
                </div>
                <p style={{ fontSize: '0.75rem', color: strengthColor[pwStrength], marginTop: '4px' }}>
                  {strengthLabel[pwStrength]}
                </p>
              </div>
            )}
          </div>

          <Input
            label="Confirm password"
            type={showConfirm ? 'text' : 'password'}
            placeholder="Repeat your password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            leftIcon={<Lock size={16} />}
            rightIcon={
              confirm
                ? confirm === password
                  ? <CheckCircle size={16} color="var(--success-400)" />
                  : showConfirm ? <EyeOff size={16} /> : <Eye size={16} />
                : showConfirm ? <EyeOff size={16} /> : <Eye size={16} />
            }
            onRightIconClick={() => setShowConfirm((v) => !v)}
            error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
            required
            autoComplete="new-password"
          />

          <Button type="submit" loading={loading} style={{ width: '100%', marginTop: '4px' }}>
            Create account
          </Button>
        </div>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '20px' }}>
        Already have an account?{' '}
        <Link href={referrerId ? `/sign-in?ref=${referrerId}` : '/sign-in'} style={{ fontWeight: 500 }}>
          Sign in
        </Link>
      </p>
    </AuthCard>
  )
}

