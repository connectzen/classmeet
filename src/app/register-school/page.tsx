'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Link2,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  BookOpen,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { useAppStore } from '@/store/app-store'

export default function RegisterSchoolPage() {
  const router = useRouter()
  const setUser = useAppStore((s) => s.setUser)

  const [schoolName, setSchoolName] = useState('')
  const [schoolSlug, setSchoolSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [defaultTeacherPw, setDefaultTeacherPw] = useState('Teacher@123')
  const [defaultStudentPw, setDefaultStudentPw] = useState('Student@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [authUser, setAuthUser] = useState<any>(null)
  const [checkingAuth, setCheckingAuth] = useState(true)

  // Get current authenticated user
  useEffect(() => {
    let mounted = true
    const supabase = createClient()
    const resolveUser = async () => {
      const { data: { user } } = await supabase.auth.getUser()

      if (!mounted) return

      if (!user) {
        setCheckingAuth(false)
        setError('We could not verify your session. Please refresh this page.')
        return
      }

      setAuthUser(user)
      setCheckingAuth(false)

      if (user.user_metadata?.full_name) {
        const name = user.user_metadata.full_name
        const generated = name
          .toLowerCase()
          .replace(/[^a-z0-9\s-]/g, '')
          .replace(/\s+/g, '-')
          .replace(/-+/g, '-')
          .replace(/^-|-$/g, '')
        setSchoolSlug(generated)
      }
    }

    resolveUser()

    return () => {
      mounted = false
    }
  }, [router])

  // Auto-generate slug from school name
  useEffect(() => {
    if (!slugManuallyEdited && schoolName) {
      const generated = schoolName
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
      setSchoolSlug(generated)
    }
  }, [schoolName, slugManuallyEdited])

  // Check slug availability
  useEffect(() => {
    if (!schoolSlug || schoolSlug.length < 2) {
      setSlugAvailable(null)
      return
    }

    const slugRegex = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
    if (!slugRegex.test(schoolSlug)) {
      setSlugAvailable(false)
      return
    }

    setSlugChecking(true)
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/schools/check-slug?slug=${encodeURIComponent(schoolSlug)}`)
        const json = await res.json()
        setSlugAvailable(json.data?.available ?? false)
      } catch {
        setSlugAvailable(null)
      } finally {
        setSlugChecking(false)
      }
    }, 500)

    return () => clearTimeout(timer)
  }, [schoolSlug])

  function validate() {
    if (!schoolName.trim()) return 'School name is required.'
    if (!schoolSlug.trim()) return 'School URL slug is required.'
    if (slugAvailable === false) return 'This school URL is not available.'
    if (defaultTeacherPw.length < 6) return 'Default teacher password must be at least 6 characters.'
    if (defaultStudentPw.length < 6) return 'Default student password must be at least 6 characters.'
    return null
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validate()
    if (err) { setError(err); return }

    setError(null)
    setLoading(true)

    try {
      const supabase = createClient()

      // Create school with the authenticated user as admin
      const res = await fetch('/api/schools/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          schoolSlug,
          adminEmail: authUser.email,
          adminName: authUser.user_metadata?.full_name || 'School Admin',
          adminPassword: '', // Not needed, user already has password set
          defaultTeacherPassword: defaultTeacherPw,
          defaultStudentPassword: defaultStudentPw,
          existingAdminId: authUser.id, // New parameter to link existing user
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Update user profile with school info and admin role
      const { error: profileError } = await supabase.from('profiles').update({
        role: 'admin',
        school_id: json.data.school.id,
        onboarding_complete: true,
        updated_at: new Date().toISOString(),
      }).eq('id', authUser.id)

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      // Update app store
      setUser({
        id: authUser.id,
        email: authUser.email,
        fullName: authUser.user_metadata?.full_name ?? '',
        avatarUrl: null,
        role: 'admin',
        onboardingComplete: true,
        schoolId: json.data.school.id,
        schoolSlug: json.data.school.slug,
        isSuperAdmin: false,
        teacherType: null,
        workspaceSlug: null,
        permissions: [],
      })

      // Redirect to school dashboard
      router.push(`/${json.data.school.slug}/admin`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (checkingAuth || !authUser) {
    return (
      <AuthCard title="Loading..." subtitle="">
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
          {error ? error : 'Preparing school registration...'}
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard title="Set up your school" subtitle="Create your ClassMeet school and configure default settings">
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <div>
            <p style={{ margin: '0 0 12px 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Hello, <strong>{authUser.user_metadata?.full_name || authUser.email}</strong>! Let's set up your school.
            </p>
          </div>

          <Input
            label="School name"
            type="text"
            placeholder="Greenfield Academy"
            value={schoolName}
            onChange={(e) => setSchoolName(e.target.value)}
            leftIcon={<Building2 size={16} />}
            required
          />

          <div>
            <Input
              label="School URL"
              type="text"
              placeholder="greenfield-academy"
              value={schoolSlug}
              onChange={(e) => {
                setSlugManuallyEdited(true)
                setSchoolSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
              }}
              leftIcon={<Link2 size={16} />}
              rightIcon={
                slugChecking ? null
                  : slugAvailable === true ? <CheckCircle size={16} color="var(--success-400)" />
                  : slugAvailable === false ? <AlertCircle size={16} color="var(--error-400)" />
                  : null
              }
              required
            />
            {schoolSlug && (
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Your school will be at: <strong>classmeet.life/{schoolSlug}</strong>
              </p>
            )}
          </div>

          {/* Default passwords section */}
          <div style={{ marginTop: '12px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
            <p style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '12px' }}>
              Default passwords for teachers & students
            </p>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '12px' }}>
              These passwords are used when you create teachers and students. They can change them later.
            </p>

            <Input
              label="Default teacher password"
              type="text"
              placeholder="Teacher@123"
              value={defaultTeacherPw}
              onChange={(e) => setDefaultTeacherPw(e.target.value)}
              leftIcon={<BookOpen size={16} />}
            />

            <Input
              label="Default student password"
              type="text"
              placeholder="Student@123"
              value={defaultStudentPw}
              onChange={(e) => setDefaultStudentPw(e.target.value)}
              leftIcon={<GraduationCap size={16} />}
              style={{ marginTop: '12px' }}
            />
          </div>

          <Button
            type="submit"
            loading={loading}
            style={{ width: '100%', marginTop: '20px' }}
            disabled={slugAvailable === false}
          >
            Create School & Get Started
          </Button>
        </div>
      </form>
    </AuthCard>
  )
}
