'use client'

import { useState, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { useSchool } from '@/lib/school-context'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import { Palette, Save, Image as ImageIcon, Globe, Check, AlertCircle } from 'lucide-react'
import { useToast } from '@/hooks/useToast'
import { canManageBranding } from '@/lib/permissions'

export default function BrandingPage() {
  const user = useAppStore(s => s.user)
  const school = useSchool()
  const { toast, show: showToast } = useToast()

  const isWorkspace = (school as any)?.isTeacherWorkspace === true
  const canBrand = canManageBranding(user?.role, user?.teacherType)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#6366f1')
  const [secondaryColor, setSecondaryColor] = useState('#818cf8')
  const [welcomeMessage, setWelcomeMessage] = useState('')
  const [saving, setSaving] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [slugAvailable, setSlugAvailable] = useState<boolean | null>(null)
  const [originalSlug, setOriginalSlug] = useState('')

  useEffect(() => {
    if (!user?.id || !isWorkspace) return
    const supabase = createClient()

    supabase
      .from('teacher_workspaces')
      .select('name, slug, primary_color, secondary_color, welcome_message')
      .eq('teacher_id', user.id)
      .single()
      .then(({ data }) => {
        if (data) {
          setName(data.name)
          setSlug(data.slug)
          setOriginalSlug(data.slug)
          setPrimaryColor(data.primary_color ?? '#6366f1')
          setSecondaryColor(data.secondary_color ?? '#818cf8')
          setWelcomeMessage(data.welcome_message ?? '')
        }
        setLoaded(true)
      })
  }, [user?.id, isWorkspace])

  useEffect(() => {
    if (!slug || slug === originalSlug) {
      setSlugAvailable(null)
      return
    }
    const timer = setTimeout(async () => {
      const supabase = createClient()
      const [{ data: schoolMatch }, { data: wsMatch }] = await Promise.all([
        supabase.from('schools').select('id').eq('slug', slug).maybeSingle(),
        supabase.from('teacher_workspaces').select('id').eq('slug', slug).maybeSingle(),
      ])
      setSlugAvailable(!schoolMatch && !wsMatch)
    }, 400)
    return () => clearTimeout(timer)
  }, [slug, originalSlug])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user?.id || saving) return
    if (slug !== originalSlug && slugAvailable === false) {
      showToast('Slug is not available')
      return
    }

    setSaving(true)
    const supabase = createClient()

    const { error } = await supabase
      .from('teacher_workspaces')
      .update({
        name: name.trim(),
        slug: slug.trim().toLowerCase(),
        primary_color: primaryColor,
        secondary_color: secondaryColor,
        welcome_message: welcomeMessage.trim() || null,
        updated_at: new Date().toISOString(),
      })
      .eq('teacher_id', user.id)

    setSaving(false)

    if (error) {
      showToast('Failed to save: ' + error.message)
    } else {
      setOriginalSlug(slug)
      showToast('Branding saved!')
      // If slug changed, redirect to new slug
      if (slug !== originalSlug) {
        window.location.href = `/${slug}/teacher/dashboard/settings/branding`
      }
    }
  }

  if (!canBrand) {
    return (
      <div style={{ maxWidth: 600, padding: '40px 20px', textAlign: 'center' }}>
        <Palette size={48} color="var(--text-muted)" style={{ margin: '0 auto 16px' }} />
        <h2 style={{ color: 'var(--text-primary)', marginBottom: 8 }}>Access Restricted</h2>
        <p style={{ color: 'var(--text-muted)' }}>Only independent teachers can customize branding.</p>
      </div>
    )
  }

  if (!loaded) {
    return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: 8 }}>
          <Palette size={22} /> Workspace Branding
        </h2>
        <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
          Customize your workspace appearance for students and collaborators
        </p>
      </div>

      <form onSubmit={handleSave}>
        {/* Workspace Name */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6 }}>
            Workspace Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="My Classroom"
            required
          />
        </div>

        {/* URL Slug */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6 }}>
            <Globe size={14} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
            URL Slug
          </label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>classmeet.live/</span>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="my-classroom"
              required
              style={{ flex: 1 }}
            />
          </div>
          {slug !== originalSlug && slugAvailable !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 6, fontSize: '0.78rem' }}>
              {slugAvailable ? (
                <><Check size={12} color="var(--success-400)" /><span style={{ color: 'var(--success-400)' }}>Available</span></>
              ) : (
                <><AlertCircle size={12} color="var(--danger-400)" /><span style={{ color: 'var(--danger-400)' }}>Already taken</span></>
              )}
            </div>
          )}
        </div>

        {/* Colors */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 12 }}>
            Brand Colors
          </label>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Primary</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                />
                <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: 4 }}>Secondary</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <input
                  type="color"
                  value={secondaryColor}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  style={{ width: 36, height: 36, border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer' }}
                />
                <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} style={{ flex: 1 }} />
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 12 }}>
            Preview
          </label>
          <div style={{
            background: `linear-gradient(135deg, ${primaryColor} 0%, ${secondaryColor} 100%)`,
            borderRadius: 'var(--radius-lg)',
            padding: '24px 28px',
            color: '#fff',
          }}>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{name || 'Your Workspace'}</div>
            <div style={{ fontSize: '0.85rem', opacity: 0.9, marginTop: 4 }}>classmeet.live/{slug || 'your-slug'}</div>
          </div>
        </div>

        {/* Welcome Message */}
        <div className="card" style={{ padding: 20, marginBottom: 16 }}>
          <label style={{ display: 'block', fontWeight: 600, fontSize: '0.85rem', color: 'var(--text-primary)', marginBottom: 6 }}>
            Welcome Message (optional)
          </label>
          <textarea
            value={welcomeMessage}
            onChange={(e) => setWelcomeMessage(e.target.value)}
            placeholder="Welcome to my classroom! Here you'll find all our courses and live sessions."
            rows={3}
            style={{
              width: '100%', padding: '10px 12px', border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-md)', background: 'var(--bg-primary)',
              color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'vertical',
            }}
          />
        </div>

        <Button type="submit" icon={<Save size={16} />} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </form>

      {toast && (
        <div className="toast toast-info" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  )
}
