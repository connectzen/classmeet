'use client'

import { useState, useEffect } from 'react'
import { Search } from 'lucide-react'

interface User {
  id: string
  full_name: string | null
  role: string
  onboarding_complete: boolean
  school_id: string | null
  is_super_admin: boolean
  schools: Array<{ id: string; name: string; slug: string }> | null
}

async function fetchUsers(search?: string, role?: string): Promise<User[]> {
  const params = new URLSearchParams()
  if (search) params.set('search', search)
  if (role) params.set('role', role)

  const res = await fetch(`/api/superadmin/users?${params}`)
  if (!res.ok) throw new Error('Failed to fetch users')
  const { data } = await res.json()
  return data
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [role, setRole] = useState('')

  useEffect(() => {
    setLoading(true)
    fetchUsers(search || undefined, role || undefined)
      .then(setUsers)
      .catch((err) => {
        console.error('Error loading users:', err)
      })
      .finally(() => setLoading(false))
  }, [search, role])

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        All Users
      </h1>

      {/* Filters */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
            Search
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type="text"
              placeholder="Name or ID..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px 8px 36px',
                border: '1px solid var(--border-subtle)',
                borderRadius: '6px',
                fontSize: '0.9rem',
              }}
            />
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-primary)' }}>
            Role
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              border: '1px solid var(--border-subtle)',
              borderRadius: '6px',
              fontSize: '0.9rem',
            }}
          >
            <option value="">All Roles</option>
            <option value="super_admin">Super Admin</option>
            <option value="admin">School Admin</option>
            <option value="teacher">Teacher</option>
            <option value="student">Student</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading users...</div>
      ) : users.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No users found.</p>
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '0.9rem',
            }}
          >
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Name
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Role
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  School
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Status
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td style={{ padding: '12px 16px', color: 'var(--text-primary)', fontWeight: 500 }}>
                    {user.full_name || 'No name'}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <span
                      style={{
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '0.8rem',
                        fontWeight: 600,
                        background: user.is_super_admin ? '#8b5cf6' : user.role === 'admin' ? '#3b82f6' : '#10b981',
                        color: '#fff',
                      }}
                    >
                      {user.is_super_admin ? 'Super Admin' : user.role}
                    </span>
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {user.schools?.[0]?.name || 'No school'}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {user.onboarding_complete ? '✓ Complete' : '⏳ Pending'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
