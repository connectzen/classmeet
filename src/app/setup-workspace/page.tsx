'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAppStore } from '@/store/app-store'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Video, Palette, Type, Globe, ArrowRight } from 'lucide-react'

function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 48)
}

export default function SetupWorkspacePage() {
  const router = useRouter()
  const { user, updateUser } = useAppStore()

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [slugManual, setSlugManual] = useState(false)
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [secondaryColor, setSecondaryColor] = useState('#818cf8')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [checking, setChecking] = useState(true)

  // Redirect if not an independent teacher
  useEffect(() => {
    const check = async () => {
      const supabase = createClient()
      const { data: { user: authUser } } = await supabase.auth.getUser()
      if (!authUser) { router.replace('/sign-in'); return }

      const { data: profile } = await supabase
        .from('profiles')
        .select('role, teacher_type')
        .eq('id', authUser.id)
        .single()

      if (profile?.role !== 'teacher' || profile?.teacher_type !== 'independent') {
        router.replace('/dashboard')
        return
      }

      // Check if workspace already exists
      const { data: existing } = await supabase
        .from('teacher_workspaces')
        .select('slug')
        .eq('teacher_id', authUser.id)
        .maybeSingle()

      if (existing) {
        router.replace(`/${existing.slug}/teacher`)
        return
      }

      // Pre-fill with user's name
      const fullName = authUser.user_metadata?.full_name as string | undefined
      if (fullName) {
        const defaultName = `${fullName}'s Classroom`
        setName(defaultName)
        setSlug(generateSlug(defaultName))
      }

      setChecking(false)
    }
    check()
  }, [router])

  // Auto-generate slug from name (unless manually edited)
  useEffect(() => {
    if (!slugManual && name) {
      setSlug(generateSlug(name))
      setSlugAvailable(null)
    }
  }, [name, slugManual])

  // Check slug availability with debounce
  useEffect(() => {
    if (!slug || slug.length < 2) { setSlugAvailable(null); return }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      // Check both schools and teacher_workspaces for slug conflicts
      const [{ data: schoolMatch }, { data: wsMatch }] = await Promise.all([
        supabase.from('schools').select('id').eq('slug', slug).maybeSingle(),
        supabase.from('teacher_workspaces').select('id').eq('slug', slug).maybeSingle(),
      ])
      setSlugAvailable(!schoolMatch && !wsMatch)
    }, 400)
    return () => clearTimeout(timer)
  }, [slug])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !slug.trim() || slugAvailable === false) return
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/setup-workspace', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), slug: slug.trim(), primaryColor, secondaryColor }),
      })

      const payload = await res.json()
      if (!res.ok) throw new Error(payload?.error || 'Could not create workspace')

      updateUser({ workspaceSlug: slug.trim() })
      router.replace(`/${slug.trim()}/teacher`)
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
      setLoading(false)
    }
  }

  if (checking) {
    return (
      <div className="onboard-page">
        <div className="onboard-card animate-slide-up">
          <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="onboard-page">
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px' }}>
        <div className="auth-logo-icon" style={{ width: 36, height: 36 }}>
          <Video size={20} color="#fff" />
        </div>
        <span className="auth-logo-name">ClassMeet</span>
      </div>

      <div className="onboard-card animate-slide-up" style={{ maxWidth: '520px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '8px' }}>Set Up Your Workspace</h2>
        <p style={{ color: 'var(--text-muted)', marginBottom: '24px', fontSize: '0.9rem' }}>
          Customize your classroom with a name, URL, and colors. Your students will see this branding.
        </p>

        {error && (
          <p style={{ color: 'var(--error-400)', marginBottom: '12px', fontSize: '0.85rem' }}>{error}</p>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {/* Workspace name */}
          <Input
            label="Workspace Name"
            placeholder="Mr. Jones Academy"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            leftIcon={<Type size={15} />}
          />

          {/* Slug */}
          <div>
            <Input
              label="URL Slug"
              placeholder="mr-jones-academy"
              value={slug}
              onChange={(e) => { setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '')); setSlugManual(true) }}
              required
              leftIcon={<Globe size={15} />}
            />
            <div style={{ fontSize: '0.75rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ color: 'var(--text-muted)' }}>classmeet.live/{slug || '...'}</span>
              {slug && slugAvailable === true && (
                <span style={{ color: 'var(--success-400)', fontWeight: 600 }}>Available</span>
              )}
              {slug && slugAvailable === false && (
                <span style={{ color: 'var(--error-400)', fontWeight: 600 }}>Taken</span>
              )}
            </div>
          </div>

          {/* Colors */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                <Palette size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Primary Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: '40px', height: '36px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{primaryColor}</span>
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>
                <Palette size={13} style={{ verticalAlign: 'middle', marginRight: '4px' }} />
                Secondary Color
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  style={{ width: '40px', height: '36px', border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: 'none' }}
                />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{secondaryColor}</span>
              </div>
            </div>
          </div>

          {/* Preview banner */}
          <div style={{
            padding: '16px 20px', borderRadius: 'var(--radius-lg)',
            background: `linear-gradient(135deg, ${primaryColor}20, ${secondaryColor}15)`,
            border: `1px solid ${primaryColor}30`,
          }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)', marginBottom: '4px' }}>Preview</div>
            <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>{name || 'Your Workspace'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px' }}>classmeet.live/{slug || '...'}</div>
          </div>

          <Button
            type="submit"
            disabled={!name.trim() || !slug.trim() || slugAvailable === false || loading}
            loading={loading}
            style={{ width: '100%' }}
          >
            Create Workspace <ArrowRight size={16} />
          </Button>
        </form>
      </div>
    </div>
  )
}
