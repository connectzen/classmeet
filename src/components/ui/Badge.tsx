import { cn, getRoleBadgeClass, formatRole } from '@/lib/utils'
import type { UserRole } from '@/lib/supabase/types'
import type { ReactNode } from 'react'

type BadgeVariant =
  | 'primary' | 'purple' | 'success' | 'warning'
  | 'error' | 'info' | 'muted'

interface BadgeProps {
  children?: ReactNode
  variant?: BadgeVariant
  role?: UserRole
  className?: string
  icon?: ReactNode
}

const variantMap: Record<BadgeVariant, string> = {
  primary: 'badge-primary',
  purple: 'badge-purple',
  success: 'badge-success',
  warning: 'badge-warning',
  error: 'badge-error',
  info: 'badge-info',
  muted: 'badge-muted',
}

export default function Badge({
  children,
  variant,
  role,
  className,
  icon,
}: BadgeProps) {
  const cls = role
    ? getRoleBadgeClass(role)
    : variant
    ? variantMap[variant]
    : 'badge-muted'

  return (
    <span className={cn('badge', cls, className)}>
      {icon && <span className="flex-shrink-0">{icon}</span>}
      {role ? formatRole(role) : children}
    </span>
  )
}

