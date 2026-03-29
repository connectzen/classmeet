'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard, Building2, Users, BarChart3, Settings,
  Shield, Menu, X,
} from 'lucide-react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import UserMenu from '@/components/layout/UserMenu'

const NAV_ITEMS = [
  { href: '/superadmin', label: 'Dashboard', icon: LayoutDashboard, countKey: null },
  { href: '/superadmin/schools', label: 'Schools', icon: Building2, countKey: 'totalSchools' as const },
  { href: '/superadmin/users', label: 'Users', icon: Users, countKey: 'totalUsers' as const },
  { href: '/superadmin/analytics', label: 'Analytics', icon: BarChart3, countKey: null },
  { href: '/superadmin/audit-logs', label: 'Audit Logs', icon: Shield, countKey: 'recentAuditCount' as const },
  { href: '/superadmin/settings', label: 'Settings', icon: Settings, countKey: null },
]

type CountKeys = 'totalSchools' | 'totalUsers' | 'recentAuditCount'

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user } = useAppStore()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [counts, setCounts] = useState<Record<CountKeys, number>>({ totalSchools: 0, totalUsers: 0, recentAuditCount: 0 })

  useEffect(() => {
    const supabase = createClient()

    const load = async () => {
      try {
        const res = await fetch('/api/superadmin/dashboard-data')
        if (!res.ok) return
        const { data } = await res.json()
        setCounts({
          totalSchools: data.stats.totalSchools ?? 0,
          totalUsers: data.stats.totalProfiles ?? 0,
          recentAuditCount: data.stats.recentAuditCount ?? 0,
        })
      } catch { /* sidebar counts can silently fail */ }
    }

    load()

    const ch = supabase
      .channel('sa-sidebar-counts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'schools' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => load())
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [])

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

        <nav style={{ paddingTop: '10px', flex: 1, overflowY: 'auto' }}>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon
            const isActive = item.href === '/superadmin'
              ? pathname === '/superadmin'
              : pathname.startsWith(item.href)
            const count = item.countKey ? counts[item.countKey] : null
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn('sidebar-link', isActive && 'active')}
                onClick={() => setSidebarOpen(false)}
                style={{ justifyContent: 'flex-start' }}
              >
                <Icon size={17} className="link-icon" />
                <span style={{ flex: 1 }}>{item.label}</span>
                {count !== null && count > 0 && (
                  <span style={{
                    fontSize: '0.72rem', fontWeight: 600,
                    background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e',
                    padding: '2px 8px', borderRadius: '10px',
                    minWidth: '20px', textAlign: 'center',
                    animation: 'fadeInScale 0.3s ease forwards',
                  }}>
                    {count}
                  </span>
                )}
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
