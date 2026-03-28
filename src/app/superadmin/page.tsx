'use client'

import { useState, useEffect } from 'react'
import { Building2, Users, Activity, TrendingUp } from 'lucide-react'

interface Stats {
  totalSchools: number
  totalUsers: number
  totalProfiles: number
  recentAuditCount: number
}

async function fetchDashboardData(): Promise<Stats> {
  const res = await fetch('/api/superadmin/dashboard-data')
  if (!res.ok) throw new Error('Failed to fetch dashboard data')
  const { data } = await res.json()
  return data
}

function StatCard({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) {
  return (
    <div className="card" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: '8px',
            background: `${color}18`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color,
          }}
        >
          <Icon size={20} />
        </div>
        <div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{label}</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--text-primary)' }}>{value.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
      .then(setStats)
      .catch((err) => {
        console.error('Error loading dashboard:', err)
        setStats({
          totalSchools: 0,
          totalUsers: 0,
          totalProfiles: 0,
          recentAuditCount: 0,
        })
      })
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div style={{ padding: '32px', textAlign: 'center' }}>
        <div style={{ color: 'var(--text-muted)' }}>Loading dashboard...</div>
      </div>
    )
  }

  return (
    <div style={{ padding: '32px' }}>
      <h1 style={{ margin: '0 0 32px', fontSize: '1.8rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        System Overview
      </h1>

      {/* Stats Grid */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '32px',
        }}
      >
        <StatCard icon={Building2} label="Total Schools" value={stats?.totalSchools || 0} color="#3b82f6" />
        <StatCard icon={Users} label="Total Users" value={stats?.totalUsers || 0} color="#10b981" />
        <StatCard icon={Activity} label="Active Profiles" value={stats?.totalProfiles || 0} color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Recent Audits" value={stats?.recentAuditCount || 0} color="#8b5cf6" />
      </div>

      {/* Welcome Section */}
      <div className="card" style={{ padding: '24px' }}>
        <h2 style={{ margin: '0 0 12px', fontSize: '1.2rem', fontWeight: 600, color: 'var(--text-primary)' }}>
          Welcome to Super Admin Panel
        </h2>
        <p style={{ margin: '0', color: 'var(--text-muted)', lineHeight: '1.6' }}>
          You have system-wide access to manage schools, users, and view analytics. Use the navigation menu to access different sections.
        </p>
      </div>
    </div>
  )
}
