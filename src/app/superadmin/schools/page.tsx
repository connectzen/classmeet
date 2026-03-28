'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import type { School } from '@/lib/supabase/types'

async function fetchSchools(): Promise<School[]> {
  const res = await fetch('/api/superadmin/schools')
  if (!res.ok) throw new Error('Failed to fetch schools')
  const { data } = await res.json()
  return data
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchSchools()
      .then(setSchools)
      .catch((err) => {
        console.error('Error loading schools:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading schools...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '32px' }}>
        <h1 style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>Schools</h1>
        <Link href="/superadmin/schools/create">
          <button className="btn btn-primary">
            <Plus size={18} />
            New School
          </button>
        </Link>
      </div>

      {schools.length === 0 ? (
        <div className="card" style={{ padding: '32px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No schools yet. Create one to get started.</p>
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
                  Slug
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Created
                </th>
                <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                  <td
                    style={{
                      padding: '12px 16px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    {school.name}
                  </td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>{school.slug}</td>
                  <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                    {new Date(school.created_at).toLocaleDateString()}
                  </td>
                  <td style={{ padding: '12px 16px' }}>
                    <Link href={`/superadmin/schools/${school.id}`}>
                      <button className="btn btn-sm btn-secondary">Edit</button>
                    </Link>
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
