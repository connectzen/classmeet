'use client'

import { useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Mail, Lock, Eye, EyeOff, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function SchoolSignInPage() {
  const params = useParams<{ schoolSlug: string }>()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || !password) {
      setError('Email and password are required.')
      return
    }

    setError(null)
    setLoading(true)

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

    // Get user profile to determine role and school
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      setError('Failed to get user data.')
      setLoading(false)
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role, school_id')
      .eq('id', user.id)
      .single()

    if (!profile) {
      setError('Profile not found.')
      setLoading(false)
      return
    }

    // Verify user belongs to this school
    const { data: school } = await supabase
      .from('schools')
      .select('id, slug')
      .eq('slug', params.schoolSlug)
      .single()

    if (!school || profile.school_id !== school.id) {
      await supabase.auth.signOut()
      setError('You do not belong to this school.')
      setLoading(false)
      return
    }

    // Redirect based on role
    const roleRoute = profile.role === 'admin' ? 'admin' : profile.role === 'teacher' ? 'teacher' : 'student'
    router.push(`/${params.schoolSlug}/${roleRoute}`)
    router.refresh()
  }

  return (
    <AuthCard title="Sign in" subtitle={`Sign in to your school account`}>
      <form onSubmit={handleSignIn} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <Input
            label="Email"
            type="email"
            placeholder="your@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            leftIcon={<Mail size={16} />}
            required
            autoComplete="email"
          />

          <Input
            label="Password"
            type={showPw ? 'text' : 'password'}
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            leftIcon={<Lock size={16} />}
            rightIcon={showPw ? <EyeOff size={16} /> : <Eye size={16} />}
            onRightIconClick={() => setShowPw((v) => !v)}
            required
            autoComplete="current-password"
          />

          <Button type="submit" loading={loading} style={{ marginTop: 4 }}>
            Sign In
          </Button>
        </div>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '20px' }}>
        Don&apos;t have a school?{' '}
        <a href="/register-school" style={{ fontWeight: 500 }}>
          Register one
        </a>
      </p>
    </AuthCard>
  )
}
