'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Users, BarChart3, Settings,
  Shield, Menu, X, Circle,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/layout/UserMenu'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/superadmin/schools', label: 'Schools', icon: Building2 },
  { href: '/superadmin/users', label: 'Users', icon: Users },
  { href: '/superadmin/analytics', label: 'Analytics', icon: BarChart3 },
  { href: '/superadmin/audit-logs', label: 'Audit Logs', icon: Shield },
  { href: '/superadmin/settings', label: 'Settings', icon: Settings },
]

function OverviewStats() {
  const [counts, setCounts] = useState({ schools: 0, users: 0, admins: 0, teachers: 0 })

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      try {
        const res = await fetch('/api/superadmin/dashboard-data')
        if (!res.ok) return
        const { data } = await res.json()
        setCounts({
          schools: data.stats.totalSchools ?? 0,
          users: data.stats.totalProfiles ?? 0,
          admins: data.stats.totalAdmins ?? 0,
          teachers: data.stats.totalTeachers ?? 0,
        })
      } catch { /* sidebar stats can silently fail */ }
    }

    load()

    const ch = supabase
      .channel('sa-sidebar-overview')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

  const statRow = (icon: React.ReactNode, label: string, value: number, color: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '6px 16px' }}>
      <div style={{
        width: 28, height: 28, borderRadius: '6px',
        background: `${color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color, flexShrink: 0,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>{label}</div>
      <div style={{ fontSize: '0.85rem', fontWeight: 700, color }}>{value}</div>
    </div>
  )

  return (
    <div className="sidebar-section" style={{ paddingTop: '10px' }}>
      <div className="sidebar-section-label">Overview</div>
      {statRow(<Building2 size={14} />, 'Schools', counts.schools, '#3b82f6')}
      {statRow(<Users size={14} />, 'Total Users', counts.users, '#22c55e')}
      {statRow(<Shield size={14} />, 'Admins', counts.admins, '#a855f7')}
      {statRow(<Circle size={14} fill="#f59e0b" />, 'Teachers', counts.teachers, '#f59e0b')}
    </div>
  )
}

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <div className="app-layout">
      {/* Mobile Backdrop — rendered before sidebar so sidebar paints on top */}
      {sidebarOpen && (
        <div
          className="backdrop"
          style={{ zIndex: 'var(--z-drawer)' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn('sidebar', sidebarOpen && 'open')} style={{ zIndex: 'var(--z-drawer)' }}>
        <div className="sidebar-logo">
          <div className="logo-icon" style={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <Shield size={20} color="#fff" />
          </div>
          <span className="logo-text">Super Admin</span>
          <button
            className="btn btn-ghost btn-icon btn-sm"
            style={{ marginLeft: 'auto', display: 'none' }}
            id="sidebar-close-btn"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close sidebar"
          >
            <X size={18} />
          </button>
        </div>

        <OverviewStats />

        <nav style={{ paddingTop: '10px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/superadmin'
              ? pathname === '/superadmin'
              : pathname.startsWith(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-link', isActive && 'active')}
                onClick={() => setSidebarOpen(false)}
              >
                <Icon size={17} className="link-icon" />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="sidebar-footer">
          <p style={{ fontSize: '0.72rem', color: 'var(--text-disabled)', textAlign: 'center' }}>
            ClassMeet Super Admin v1.0
          </p>
        </div>
      </aside>

      {/* Main Content */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
        {/* Top Bar */}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <button
              id="sidebar-toggle"
              className="btn btn-ghost btn-icon btn-sm"
              onClick={() => setSidebarOpen(!sidebarOpen)}
              aria-label="Toggle sidebar"
            >
              <Menu size={20} />
            </button>
            <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
              Super Admin Panel
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <UserMenu />
          </div>
        </header>

        {/* Page Content */}
        <main className="main-content">{children}</main>
      </div>
    </div>
  )
}
