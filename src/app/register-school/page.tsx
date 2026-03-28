'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  Link2,
  User,
  Mail,
  Lock,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  GraduationCap,
  BookOpen,
} from 'lucide-react'
import AuthCard from '@/components/auth/AuthCard'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'

export default function RegisterSchoolPage() {
  const router = useRouter()
  const [schoolName, setSchoolName] = useState('')
  const [schoolSlug, setSchoolSlug] = useState('')
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [slugChecking, setSlugChecking] = useState(false)
  const [adminName, setAdminName] = useState('')
  const [adminEmail, setAdminEmail] = useState('')
  const [adminPassword, setAdminPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [defaultTeacherPw, setDefaultTeacherPw] = useState('Teacher@123')
  const [defaultStudentPw, setDefaultStudentPw] = useState('Student@123')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [step, setStep] = useState<'school' | 'admin' | 'defaults'>('school')

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

  // Check slug availability with debounce
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

  function validateStep() {
    if (step === 'school') {
      if (!schoolName.trim()) return 'School name is required.'
      if (!schoolSlug.trim()) return 'School URL slug is required.'
      if (slugAvailable === false) return 'This school URL is not available.'
      return null
    }
    if (step === 'admin') {
      if (!adminName.trim()) return 'Admin name is required.'
      if (!adminEmail.trim()) return 'Admin email is required.'
      if (adminPassword.length < 8) return 'Password must be at least 8 characters.'
      if (adminPassword !== confirmPassword) return 'Passwords do not match.'
      return null
    }
    if (step === 'defaults') {
      if (defaultTeacherPw.length < 6) return 'Default teacher password must be at least 6 characters.'
      if (defaultStudentPw.length < 6) return 'Default student password must be at least 6 characters.'
      return null
    }
    return null
  }

  function handleNext(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep()
    if (err) { setError(err); return }
    setError(null)
    if (step === 'school') setStep('admin')
    else if (step === 'admin') setStep('defaults')
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const err = validateStep()
    if (err) { setError(err); return }

    setError(null)
    setLoading(true)

    try {
      const res = await fetch('/api/schools/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          schoolName,
          schoolSlug,
          adminName,
          adminEmail,
          adminPassword,
          defaultTeacherPassword: defaultTeacherPw,
          defaultStudentPassword: defaultStudentPw,
        }),
      })

      const json = await res.json()

      if (!res.ok) {
        setError(json.error || 'Registration failed')
        setLoading(false)
        return
      }

      // Redirect to sign-in at the school's URL
      router.push(`/${json.data.school.slug}/sign-in`)
    } catch {
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const pwStrength = adminPassword.length === 0 ? 0
    : adminPassword.length < 6 ? 1
    : adminPassword.length < 10 ? 2
    : /[A-Z]/.test(adminPassword) && /[0-9]/.test(adminPassword) ? 4 : 3

  const strengthLabel = ['', 'Weak', 'Fair', 'Good', 'Strong']
  const strengthColor = ['', 'var(--error-400)', 'var(--warning-400)', 'var(--info-400)', 'var(--success-400)']

  const stepTitles = {
    school: 'Register your school',
    admin: 'Admin account',
    defaults: 'Default passwords',
  }
  const stepSubtitles = {
    school: 'Set up your school on ClassMeet',
    admin: 'Create your admin credentials',
    defaults: 'Default passwords for teachers & students',
  }

  return (
    <AuthCard title={stepTitles[step]} subtitle={stepSubtitles[step]}>
      {/* Step indicator */}
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '24px' }}>
        {(['school', 'admin', 'defaults'] as const).map((s, i) => (
          <div
            key={s}
            style={{
              width: '40px',
              height: '4px',
              borderRadius: '2px',
              background: i <= ['school', 'admin', 'defaults'].indexOf(step)
                ? 'var(--primary-400)'
                : 'var(--border-subtle)',
              transition: 'background 0.2s',
            }}
          />
        ))}
      </div>

      <form onSubmit={step === 'defaults' ? handleSubmit : handleNext} noValidate>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {error && (
            <div className="alert alert-error animate-fade-in">
              <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          {step === 'school' && (
            <>
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
                    Your school will be at: <strong>classmeet.com/{schoolSlug}</strong>
                  </p>
                )}
              </div>
            </>
          )}

          {step === 'admin' && (
            <>
              <Input
                label="Your full name"
                type="text"
                placeholder="Jane Smith"
                value={adminName}
                onChange={(e) => setAdminName(e.target.value)}
                leftIcon={<User size={16} />}
                required
                autoComplete="name"
              />

              <Input
                label="Admin email"
                type="email"
                placeholder="admin@school.com"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                leftIcon={<Mail size={16} />}
                required
                autoComplete="email"
              />

              <div>
                <Input
                  label="Password"
                  type={showPw ? 'text' : 'password'}
                  placeholder="At least 8 characters"
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  leftIcon={<Lock size={16} />}
                  rightIcon={showPw ? <EyeOff size={16} /> : <Eye size={16} />}
                  onRightIconClick={() => setShowPw((v) => !v)}
                  required
                  autoComplete="new-password"
                />
                {adminPassword && (
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
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock size={16} />}
                rightIcon={
                  confirmPassword
                    ? confirmPassword === adminPassword
                      ? <CheckCircle size={16} color="var(--success-400)" />
                      : showConfirm ? <EyeOff size={16} /> : <Eye size={16} />
                    : showConfirm ? <EyeOff size={16} /> : <Eye size={16} />
                }
                onRightIconClick={() => setShowConfirm((v) => !v)}
                error={confirmPassword && confirmPassword !== adminPassword ? 'Passwords do not match' : undefined}
                required
                autoComplete="new-password"
              />
            </>
          )}

          {step === 'defaults' && (
            <>
              <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', marginBottom: '4px' }}>
                These passwords are used when you create teachers and students. They can change their password later.
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
              />
            </>
          )}

          <div style={{ display: 'flex', gap: '12px', marginTop: '4px' }}>
            {step !== 'school' && (
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setError(null)
                  if (step === 'admin') setStep('school')
                  else if (step === 'defaults') setStep('admin')
                }}
                style={{ flex: 1 }}
              >
                Back
              </Button>
            )}
            <Button
              type="submit"
              loading={loading}
              style={{ flex: 1 }}
              disabled={step === 'school' && slugAvailable === false}
            >
              {step === 'defaults' ? 'Create School' : 'Next'}
            </Button>
          </div>
        </div>
      </form>

      <p style={{ textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-muted)', marginTop: '20px' }}>
        Already have a school?{' '}
        <a href="/sign-in" style={{ fontWeight: 500 }}>
          Sign in
        </a>
      </p>
    </AuthCard>
  )
}
