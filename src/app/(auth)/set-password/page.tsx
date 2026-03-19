'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Lock, Eye, EyeOff, User, CheckCircle2, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

function SetPasswordContent() {
  const router       = useRouter()
  const searchParams = useSearchParams()
  const next         = searchParams.get('next') ?? '/onboarding'

  const [fullName,  setFullName]  = useState('')
  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [showPw,    setShowPw]    = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState<string | null>(null)
  const [done,      setDone]      = useState(false)

  // Pre-fill name only if the stored value is a real name, not an email address.
  // Supabase sets full_name to the email for invited users when no name was provided.
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const existing = user?.user_metadata?.full_name as string | undefined
      if (existing && !existing.includes('@') && existing !== user?.email) {
        setFullName(existing)
      }
    })
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fullName.trim())        { setError('Please enter your name.'); return }
    if (password.length < 8)     { setError('Password must be at least 8 characters.'); return }
    if (password !== confirm)    { setError('Passwords do not match.'); return }

    setError(null)
    setLoading(true)

    const supabase = createClient()

    // Save password + full_name to auth metadata in one call
    const { error: authErr } = await supabase.auth.updateUser({
      password,
      data: { full_name: fullName.trim(), needs_password_setup: false },
    })

    if (authErr) { setError(authErr.message); setLoading(false); return }

    // Mirror the name to the profiles table so the dashboard can display it
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase
        .from('profiles')
        .update({ full_name: fullName.trim(), updated_at: new Date().toISOString() })
        .eq('id', user.id)
    }

    setLoading(false)
    setDone(true)
    setTimeout(() => router.push(next), 1200)
  }

  return (
    <AuthCard
      title="Welcome to ClassMeet"
      subtitle="Set your name and create a password to get started"
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
            <span>All set! Continuing…</span>
          </div>
        )}

        <Input
          label="Your name"
          type="text"
          required
          placeholder="Jane Smith"
          value={fullName}
          onChange={e => setFullName(e.target.value)}
          leftIcon={<User size={15} />}
          autoComplete="name"
        />

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
          Set Password &amp; Continue
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
