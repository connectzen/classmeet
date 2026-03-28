'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'

interface UserProfile {
  id: string
  full_name: string | null
  email: string | null
  role: string
  school_id: string | null
  is_super_admin: boolean
  onboarding_complete: boolean
  avatar_url: string | null
  created_at: string
  schools?: Array<{ id: string; name: string; slug: string }>
}

async function fetchUser(userId: string): Promise<UserProfile> {
  const res = await fetch(`/api/superadmin/users?search=${userId}`)
  if (!res.ok) throw new Error('Failed to fetch user')
  const { data } = await res.json()
  const user = data[0]
  if (!user) throw new Error('User not found')
  return user
}

export default function UserDetailPage({ params }: { params: Promise<{ userId: string }> }) {
  const router = useRouter()
  const [userId, setUserId] = useState<string>('')
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    params.then(({ userId }) => {
      setUserId(userId)
      fetchUser(userId)
        .then(setUser)
        .catch((err) => {
          console.error('Error loading user:', err)
        })
        .finally(() => setLoading(false))
    })
  }, [params])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading user...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-danger)' }}>User not found</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px', maxWidth: '600px' }}>
      <Link href="/superadmin/users">
        <button className="btn btn-sm btn-secondary" style={{ marginBottom: '24px' }}>
          <ArrowLeft size={16} />
          Back
        </button>
      </Link>

      <h1 style={{ margin: '0 0 24px 0', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        User Details
      </h1>

      <div className="card" style={{ padding: '24px', marginBottom: '24px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', marginBottom: '24px' }}>
          {user.avatar_url && (
            <img
              src={user.avatar_url}
              alt={user.full_name || 'User'}
              style={{
                width: '80px',
                height: '80px',
                borderRadius: '8px',
                objectFit: 'cover',
              }}
            />
          )}
          <div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '1.3rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              {user.full_name || 'No name'}
            </h2>
            <p style={{ margin: '0 0 8px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
              {user.email || 'No email'}
            </p>
            <span
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '0.8rem',
                fontWeight: 600,
                background: user.is_super_admin ? '#8b5cf6' : user.role === 'admin' ? '#3b82f6' : '#10b981',
                color: '#fff',
                display: 'inline-block',
              }}
            >
              {user.is_super_admin ? 'Super Admin' : user.role}
            </span>
          </div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '16px' }}>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              User ID
            </label>
            <p style={{ margin: 0, color: 'var(--text-primary)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
              {user.id}
            </p>
          </div>

          {user.schools?.[0] && (
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
                School
              </label>
              <p style={{ margin: 0, color: 'var(--text-primary)' }}>
                {user.schools[0].name}
              </p>
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Onboarding Status
            </label>
            <p style={{ margin: 0, color: 'var(--text-primary)' }}>
              {user.onboarding_complete ? '✓ Complete' : '⏳ Pending'}
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px' }}>
              Created
            </label>
            <p style={{ margin: 0, color: 'var(--text-primary)' }}>
              {new Date(user.created_at).toLocaleString()}
            </p>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '12px' }}>
        <button
          onClick={() => router.back()}
          className="btn btn-secondary"
          style={{ flex: 1 }}
        >
          Close
        </button>
      </div>
    </div>
  )
}
