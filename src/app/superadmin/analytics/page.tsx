'use client'

import { useState, useEffect } from 'react'
import { BarChart3, TrendingUp } from 'lucide-react'

interface AnalyticsData {
  stats: {
    totalSchools: number
    totalUsers: number
    totalProfiles: number
    recentAuditCount: number
  }
  recentAudits: Array<{
    id: string
    action: string
    created_at: string
  }>
}

async function fetchAnalyticsData(): Promise<AnalyticsData> {
  const res = await fetch('/api/superadmin/dashboard-data')
  if (!res.ok) throw new Error('Failed to fetch analytics')
  return res.json().then(r => r.data)
}

interface SchoolData {
  id: string
  name: string
  slug: string
  created_at: string
}

async function fetchSchools(): Promise<SchoolData[]> {
  const res = await fetch('/api/superadmin/schools')
  if (!res.ok) throw new Error('Failed to fetch schools')
  return res.json().then(r => r.data)
}

export default function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null)
  const [schools, setSchools] = useState<SchoolData[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([fetchAnalyticsData(), fetchSchools()])
      .then(([analyticsData, schoolsData]) => {
        setAnalytics(analyticsData)
        setSchools(schoolsData)
      })
      .catch((err) => {
        console.error('Error loading analytics:', err)
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading analytics...</div>
      </div>
    )
  }

  if (!analytics) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-danger)' }}>Failed to load analytics</div>
      </div>
    )
  }

  const avgUsersPerSchool = schools.length > 0 ? Math.round(analytics.stats.totalUsers / schools.length) : 0
  const actionCounts = analytics.recentAudits.reduce((acc: Record<string, number>, log: any) => {
    acc[log.action] = (acc[log.action] || 0) + 1
    return acc
  }, {})

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        System Analytics
      </h1>

      {/* Key Metrics */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Total Schools
              </p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.stats.totalSchools}
              </p>
            </div>
            <BarChart3 size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
            <div>
              <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                Total Users
              </p>
              <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {analytics.stats.totalUsers}
              </p>
            </div>
            <TrendingUp size={24} style={{ color: 'var(--text-muted)' }} />
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Avg Users/School
            </p>
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {avgUsersPerSchool}
            </p>
          </div>
        </div>

        <div className="card" style={{ padding: '20px' }}>
          <div>
            <p style={{ margin: '0 0 8px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>
              Recent Actions
            </p>
            <p style={{ margin: 0, fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {analytics.stats.recentAuditCount}
            </p>
          </div>
        </div>
      </div>

      {/* Schools by Creation Date */}
      <div className="card" style={{ padding: '24px', marginBottom: '32px' }}>
        <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Schools by Creation Date
        </h2>
        {schools.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', margin: 0 }}>No schools created yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', fontSize: '0.9rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-subtle)', backgroundColor: 'var(--bg-secondary)' }}>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    School Name
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Slug
                  </th>
                  <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-muted)' }}>
                    Created
                  </th>
                </tr>
              </thead>
              <tbody>
                {schools.map((school) => (
                  <tr key={school.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '12px 16px', color: 'var(--text-primary)' }}>
                      {school.name}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                      {school.slug}
                    </td>
                    <td style={{ padding: '12px 16px', color: 'var(--text-muted)' }}>
                      {new Date(school.created_at).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Action Breakdown */}
      {Object.keys(actionCounts).length > 0 && (
        <div className="card" style={{ padding: '24px' }}>
          <h2 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Recent Actions Breakdown
          </h2>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
            {Object.entries(actionCounts).map(([action, count]) => (
              <div
                key={action}
                style={{
                  padding: '12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  borderLeft: '4px solid #3b82f6',
                }}
              >
                <p style={{ margin: '0 0 4px 0', fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                  {action.replace(/_/g, ' ')}
                </p>
                <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                  {count}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
