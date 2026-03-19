import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { UserRole } from '@/lib/supabase/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return '?'
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0])
    .join('')
    .toUpperCase()
}

export function getAvatarGradient(name: string | null | undefined): string {
  const gradients = [
    'avatar-gradient-1',
    'avatar-gradient-2',
    'avatar-gradient-3',
    'avatar-gradient-4',
    'avatar-gradient-5',
  ]
  if (!name) return gradients[0]
  const idx = name.charCodeAt(0) % gradients.length
  return gradients[idx]
}

export function getRoleBadgeClass(role: string): string {
  const map: Record<string, string> = {
    admin: 'badge-admin',
    teacher: 'badge-teacher',
    student: 'badge-student',
  }
  return map[role] ?? 'badge-muted'
}

export function formatRole(role: string): string {
  return role.charAt(0).toUpperCase() + role.slice(1)
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

export function isCreatorRole(role: UserRole | null | undefined): boolean {
  return role === 'teacher' || role === 'admin'
}

