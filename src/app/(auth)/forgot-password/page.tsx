'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Mail, ArrowLeft, Lock, Eye, EyeOff, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

type Step = 'email' | 'code' | 'password' | 'done'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSendCode(e: React.FormEvent) {
    e.preventDefault()
    if (!email) { setError('Email is required.'); return }
    setError(null); setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('code')
  }

  async function handleVerifyCode(e: React.FormEvent) {
    e.preventDefault()
    if (code.length < 6) { setError('Enter the full 6-digit code.'); return }
    setError(null); setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email, token: code, type: 'recovery',
    })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('password')
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    setError(null); setLoading(true)
    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (err) { setError(err.message); return }
    setStep('done')
    setTimeout(() => router.push('/sign-in'), 2500)
  }

  const titles: Record<Step, { title: string; subtitle: string }> = {
    email: { title: 'Forgot password?', subtitle: "We'll send a reset code to your email." },
    code: { title: 'Enter reset code', subtitle: `Check ${email} for your 6-digit code.` },
    password: { title: 'Set new password', subtitle: 'Choose a strong password for your account.' },
    done: { title: 'Password updated!', subtitle: 'You can now sign in with your new password.' },
  }

  return (
    <AuthCard title={titles[step].title} subtitle={titles[step].subtitle}>
      {error && (
        <div className="alert alert-error animate-fade-in" style={{ marginBottom: '16px' }}>
          <AlertCircle size={16} style={{ flexShrink: 0 }} />
          <span>{error}</span>
        </div>
      )}

      {step === 'email' && (
        <form onSubmit={handleSendCode}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="Email address"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail size={16} />}
              required
            />
            <Button type="submit" loading={loading} style={{ width: '100%' }}>
              Send reset code
            </Button>
            <Link href="/sign-in" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.875rem', justifyContent: 'center' }}>
              <ArrowLeft size={14} /> Back to sign in
            </Link>
          </div>
        </form>
      )}

      {step === 'code' && (
        <form onSubmit={handleVerifyCode}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="6-digit code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              required
            />
            <Button type="submit" loading={loading} style={{ width: '100%' }}>
              Verify code
            </Button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setStep('email'); setError(null) }}
              style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center', width: '100%' }}>
              <ArrowLeft size={14} /> Change email
            </button>
          </div>
        </form>
      )}

      {step === 'password' && (
        <form onSubmit={handleResetPassword}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input
              label="New password"
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              leftIcon={<Lock size={16} />}
              rightIcon={showPw ? <EyeOff size={16} /> : <Eye size={16} />}
              onRightIconClick={() => setShowPw((v) => !v)}
              required
            />
            <Input
              label="Confirm new password"
              type="password"
              placeholder="Repeat your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              leftIcon={<Lock size={16} />}
              error={confirm && confirm !== password ? 'Passwords do not match' : undefined}
              required
            />
            <Button type="submit" loading={loading} style={{ width: '100%' }}>
              Update password
            </Button>
          </div>
        </form>
      )}

      {step === 'done' && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'var(--success-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <CheckCircle2 size={28} color="var(--success-400)" />
          </div>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem' }}>
            Redirecting you to sign in…
          </p>
        </div>
      )}
    </AuthCard>
  )
}

