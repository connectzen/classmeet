'use client'

import { useAppStore } from '@/store/app-store'
import type { TeacherPermissionKey } from '@/lib/supabase/types'
import { isOwnerTier } from '@/lib/permissions'
import { ShieldOff } from 'lucide-react'

interface Props {
  /** Single permission key or array (any match = access granted) */
  permission: TeacherPermissionKey | TeacherPermissionKey[]
  children: React.ReactNode
}

export default function PermissionGate({ permission, children }: Props) {
  const user = useAppStore((s) => s.user)

  if (!user) return null

  // Admins and independent teachers always pass
  if (user.role === 'admin' || isOwnerTier(user.role, user.teacherType)) {
    return <>{children}</>
  }

  // Students don't need permission gates (they see student views)
  if (user.role === 'student') {
    return <>{children}</>
  }

  // Check if teacher has any of the required permissions
  const perms = user.permissions ?? []
  const keys = Array.isArray(permission) ? permission : [permission]
  const hasAccess = keys.some((k) => perms.includes(k))

  if (!hasAccess) {
    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '60px 24px', textAlign: 'center', minHeight: '50vh',
      }}>
        <div style={{
          width: 64, height: 64, borderRadius: '50%',
          background: 'rgba(239, 68, 68, 0.1)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', marginBottom: 16,
        }}>
          <ShieldOff size={28} color="var(--error-500, #ef4444)" />
        </div>
        <h2 style={{
          fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)',
          margin: '0 0 8px',
        }}>
          Access Restricted
        </h2>
        <p style={{
          fontSize: '0.875rem', color: 'var(--text-muted)',
          maxWidth: 400, lineHeight: 1.5, margin: 0,
        }}>
          You don&apos;t have permission to access this page.
          Contact your school administrator to request access.
        </p>
      </div>
    )
  }

  return <>{children}</>
}
