'use client'

import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Users, Activity, TrendingUp, ArrowRight, Plus, Shield } from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import Avatar from '@/components/ui/Avatar'
import Badge from '@/components/ui/Badge'
import Button from '@/components/ui/Button'

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

interface QuickAction {
  label: string
  desc: string
  icon: React.ElementType
  color: string
  href: string
  statKey?: keyof Stats
}

const QUICK_ACTIONS: QuickAction[] = [
  { label: 'Manage Schools',  desc: 'View & create schools',    icon: Building2,  color: 'var(--primary-500)', href: '/superadmin/schools',     statKey: 'totalSchools' },
  { label: 'Manage Users',    desc: 'View all platform users',  icon: Users,      color: 'var(--success-400)', href: '/superadmin/users',       statKey: 'totalUsers'   },
  { label: 'View Analytics',  desc: 'Platform-wide insights',   icon: Activity,   color: 'var(--accent-500)',  href: '/superadmin/analytics'   },
  { label: 'Audit Logs',      desc: 'Review system activity',   icon: TrendingUp, color: 'var(--warning-400)', href: '/superadmin/audit-logs',  statKey: 'recentAuditCount' },
]

function StatCard({ icon: Icon, label, value, color }: { icon: React.ElementType; label: string; value: number; color: string }) {
  return (
    <div className="card card-interactive" style={{ padding: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: 44, height: 44, borderRadius: 'var(--radius-md)',
          background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color,
        }}>
          <Icon size={22} />
        </div>
        <div>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '2px' }}>{label}</div>
          <div style={{ fontSize: '1.7rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1 }}>{value.toLocaleString()}</div>
        </div>
      </div>
    </div>
  )
}

export default function SuperAdminDashboard() {
  const router = useRouter()
  const user = useAppStore((s) => s.user)
  const [stats, setStats] = useState<Stats | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDashboardData()
      .then(setStats)
      .catch(() => {
        setStats({ totalSchools: 0, totalUsers: 0, totalProfiles: 0, recentAuditCount: 0 })
      })
      .finally(() => setLoading(false))
  }, [])

  const greeting = useMemo(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }, [])

  if (loading) {
    return (
      <div style={{ maxWidth: '960px', padding: '32px 0' }}>
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading dashboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '960px' }}>

      {/* Welcome banner */}
      <div
        className="card card-elevated stagger-item"
        style={{
          marginBottom: '24px', padding: '28px 32px',
          background: 'linear-gradient(135deg, rgba(102,126,234,0.14) 0%, rgba(118,75,162,0.10) 100%)',
          borderColor: 'var(--border-primary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <Avatar src={user?.avatarUrl} name={user?.fullName} size="lg" />
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px', flexWrap: 'wrap' }}>
              <h2 style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {greeting}, {user?.fullName?.split(' ')[0] ?? 'Admin'}!
              </h2>
              <Badge role="super_admin" />
            </div>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', margin: 0 }}>
              System-wide access to manage schools, users, and platform analytics.
            </p>
          </div>
          <Button icon={<Plus size={16} />} size="sm" onClick={() => router.push('/superadmin/schools/create')}>
            New School
          </Button>
        </div>
      </div>

      {/* Stats grid */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px', marginBottom: '24px',
      }}>
        <StatCard icon={Building2}  label="Total Schools"   value={stats?.totalSchools ?? 0}    color="#3b82f6" />
        <StatCard icon={Users}      label="Total Users"     value={stats?.totalUsers ?? 0}      color="#10b981" />
        <StatCard icon={Activity}   label="Active Profiles" value={stats?.totalProfiles ?? 0}   color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Recent Audits"   value={stats?.recentAuditCount ?? 0} color="#8b5cf6" />
      </div>

      {/* Quick actions */}
      <h3 style={{
        margin: '0 0 14px', fontSize: '0.85rem', fontWeight: 600,
        textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-muted)',
        display: 'flex', alignItems: 'center', gap: '8px',
      }}>
        <Shield size={15} /> Quick Actions
      </h3>

      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '14px', marginBottom: '24px',
      }}>
        {QUICK_ACTIONS.map((action, i) => {
          const Icon = action.icon
          const statVal = action.statKey && stats ? stats[action.statKey] : undefined
          return (
            <div
              key={action.label}
              className="card card-interactive stagger-item"
              style={{ padding: '20px', cursor: 'pointer', animationDelay: `${i * 60}ms` }}
              onClick={() => router.push(action.href)}
            >
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  background: `color-mix(in srgb, ${action.color} 15%, transparent)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Icon size={20} style={{ color: action.color }} />
                </div>
                {statVal !== undefined && (
                  <span style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {statVal}
                  </span>
                )}
              </div>
              <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {action.label}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                {action.desc}
                <ArrowRight size={14} style={{ opacity: 0.5, flexShrink: 0 }} />
              </div>
            </div>
          )
        })}
      </div>

    </div>
  )
}
