'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SignInPage() {
  return <Suspense><SignInPageInner /></Suspense>
}

function SignInPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const referrerId = searchParams.get('ref') // capture ?ref= for teacher switching
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Store referrer for teacher switching (processed on dashboard load)
    if (referrerId) {
      localStorage.setItem('classmeet_teacher_id', referrerId)
      localStorage.setItem('classmeet_referrer', referrerId)
    }

    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <AuthCard
      title="Welcome back"
      subtitle="Sign in to your ClassMeet account"
    >
      <form onSubmit={handleSignIn} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

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

          <Input
            label="Password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            rightIcon={showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            onRightIconClick={() => setShowPassword((v) => !v)}
            required
            autoComplete="current-password"
          />

          <div style={{ textAlign: 'right', marginTop: '-8px' }}>
            <Link href="/forgot-password" style={{ fontSize: '0.8rem' }}>
              Forgot password?
            </Link>
          </div>

          <Button type="submit" loading={loading} style={{ width: '100%', marginTop: '4px' }}>
            Sign in
          </Button>
        </div>
      </form>

      <div className="divider" style={{ margin: '20px 0' }}>or</div>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
        Don&apos;t have an account?{' '}
        <Link href={referrerId ? `/sign-up?ref=${referrerId}` : '/sign-up'} style={{ fontWeight: 500 }}>
          Create one
        </Link>
      </p>
    </AuthCard>
  )
}

