'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import type { TeacherPermissionKey } from '@/lib/supabase/types'
import { isOwnerTier } from '@/lib/permissions'

interface Props {
  /** Single permission key or array (any match = access granted) */
  permission: TeacherPermissionKey | TeacherPermissionKey[]
  children: React.ReactNode
}

export default function PermissionGate({ permission, children }: Props) {
  const user = useAppStore((s) => s.user)
  const router = useRouter()

  // Determine access
  const bypass =
    !user ||
    user.role === 'admin' ||
    user.role === 'student' ||
    isOwnerTier(user.role, user.teacherType)

  const perms = user?.permissions ?? []
  const keys = Array.isArray(permission) ? permission : [permission]
  const hasAccess = bypass || keys.some((k) => perms.includes(k))

  useEffect(() => {
    if (user && !hasAccess) {
      router.replace('../dashboard')
    }
  }, [user, hasAccess, router])

  if (!user || !hasAccess) return null

  return <>{children}</>
}
