'use client'

import { useState, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function SetPasswordContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const next = searchParams.get('next') ?? '/onboarding'

  const [password, setPassword] = useState('')
  const [confirm, setConfirm]   = useState('')
  const [showPw, setShowPw]     = useState(false)
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState<string | null>(null)
  const [done, setDone]         = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password.length < 8) { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }

    setError(null)
    setLoading(true)

    const supabase = createClient()
    const { error: err } = await supabase.auth.updateUser({ password })

    setLoading(false)

    if (err) { setError(err.message); return }

    setDone(true)
    setTimeout(() => router.push(next), 1200)
  }

  return (
    <AuthCard
      title="Set your password"
      subtitle="Create a password so you can log in next time"
    >
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {error && (
          <div className="alert alert-error animate-fade-in">
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            <span>{error}</span>
          </div>
        )}

        {done && (
          <div className="alert alert-success animate-fade-in">
            <CheckCircle2 size={16} style={{ flexShrink: 0 }} />
            <span>Password set! Continuing…</span>
          </div>
        )}

        <Input
          label="Password"
          type={showPw ? 'text' : 'password'}
          required
          placeholder="At least 8 characters"
          value={password}
          onChange={e => setPassword(e.target.value)}
          leftIcon={<Lock size={15} />}
          rightIcon={
            <button type="button" onClick={() => setShowPw(v => !v)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          }
        />

        <Input
          label="Confirm password"
          type={showPw ? 'text' : 'password'}
          required
          placeholder="Repeat your password"
          value={confirm}
          onChange={e => setConfirm(e.target.value)}
          leftIcon={<Lock size={15} />}
        />

        <Button type="submit" loading={loading} disabled={done} style={{ width: '100%', marginTop: '4px' }}>
          Set Password & Continue
        </Button>
      </form>
    </AuthCard>
  )
}

export default function SetPasswordPage() {
  return (
    <Suspense>
      <SetPasswordContent />
    </Suspense>
  )
}
