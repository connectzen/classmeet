'use client'

import { useState, useRef, useEffect, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { Mail, AlertCircle, CheckCircle2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'

const CODE_LENGTH = 8
const RESEND_COOLDOWN = 60

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const email = searchParams.get('email') ?? ''
  const router = useRouter()

  const [code, setCode] = useState<string[]>(Array(CODE_LENGTH).fill(''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const inputsRef = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    inputsRef.current[0]?.focus()
  }, [])

  useEffect(() => {
    if (cooldown <= 0) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  function handleChange(index: number, value: string) {
    const char = value.replace(/\D/g, '').slice(-1)
    const next = [...code]
    next[index] = char
    setCode(next)
    if (char && index < CODE_LENGTH - 1) {
      inputsRef.current[index + 1]?.focus()
    }
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  function handlePaste(e: React.ClipboardEvent) {
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, CODE_LENGTH)
    if (pasted.length > 0) {
      const next = [...pasted.split(''), ...Array(CODE_LENGTH).fill('')].slice(0, CODE_LENGTH)
      setCode(next)
      const lastFilled = Math.min(pasted.length, CODE_LENGTH - 1)
      inputsRef.current[lastFilled]?.focus()
    }
    e.preventDefault()
  }

  async function handleVerify() {
    const otp = code.join('')
    if (otp.length < CODE_LENGTH) {
      setError('Please enter the full 8-digit code.')
      return
    }
    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.verifyOtp({
      email,
      token: otp,
      type: 'signup',
    })

    if (err) {
      setError(err.message)
      setLoading(false)
      return
    }

    setSuccess(true)
    setTimeout(() => router.push('/onboarding'), 1500)
  }

  async function handleResend() {
    setCooldown(RESEND_COOLDOWN)
    const supabase = createClient()
    await supabase.auth.resend({ type: 'signup', email })
  }

  return (
    <AuthCard
      title="Check your email"
      subtitle={`We sent an 8-digit code to ${email || 'your email'}`}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', alignItems: 'center' }}>
        <div style={{
          width: 56, height: 56,
          borderRadius: '50%',
          background: 'rgba(99,102,241,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Mail size={24} color="var(--primary-400)" />
        </div>

        {error && (
          <div className="alert alert-error animate-fade-in" style={{ width: '100%' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="alert alert-success animate-fade-in" style={{ width: '100%' }}>
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>Email verified! Redirecting…</span>
          </div>
        )}

        <div className="code-input-container" onPaste={handlePaste}>
          {code.map((digit, i) => (
            <input
              key={i}
              ref={(el) => { inputsRef.current[i] = el }}
              className={`code-input ${digit ? 'filled' : ''}`}
              type="text"
              inputMode="numeric"
              maxLength={1}
              value={digit}
              onChange={(e) => handleChange(i, e.target.value)}
              onKeyDown={(e) => handleKeyDown(i, e)}
              aria-label={`Code digit ${i + 1}`}
            />
          ))}
        </div>

        <Button
          onClick={handleVerify}
          loading={loading}
          disabled={success}
          style={{ width: '100%' }}
        >
          Verify email
        </Button>

        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Didn&apos;t receive it?{' '}
          {cooldown > 0 ? (
            <span style={{ color: 'var(--text-disabled)' }}>Resend in {cooldown}s</span>
          ) : (
            <button
              onClick={handleResend}
              className="btn btn-ghost btn-sm"
              style={{ display: 'inline', padding: '0', fontWeight: 500, color: 'var(--primary-400)' }}
            >
              Resend code
            </button>
          )}
        </p>
      </div>
    </AuthCard>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  )
}

