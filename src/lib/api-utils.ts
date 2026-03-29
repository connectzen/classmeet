import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'
import type { TeacherPermissionKey } from '@/lib/supabase/types'

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number = 500
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

export function apiResponse<T>(data: T, status = 200) {
  return NextResponse.json({ data }, { status })
}

export function apiError(error: unknown, defaultStatus = 500) {
  let message = 'Internal server error'
  let status = defaultStatus

  if (error instanceof ApiError) {
    message = error.message
    status = error.status
  } else if (error instanceof Error) {
    message = error.message
  } else if (typeof error === 'string') {
    message = error
  }

  console.error('[API Error]', message, error)
  return NextResponse.json({ error: message }, { status })
}

export async function requireAuth(request: Request): Promise<User> {
  const supabase = await createClient()
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser()

  if (error || !user) {
    throw new ApiError('Unauthorized', 401)
  }

  return user
}

export async function requireSchoolContext(request: Request): Promise<{ userId: string; schoolId: string }> {
  const user = await requireAuth(request)
  const supabase = await createClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('school_id')
    .eq('id', user.id)
    .single()

  if (error || !profile?.school_id) {
    throw new ApiError('User not associated with a school', 403)
  }

  return { userId: user.id, schoolId: profile.school_id }
}

export async function requireSuperAdmin(request: Request): Promise<string> {
  const user = await requireAuth(request)
  const supabase = await createClient()

  const result = await supabase
    .from('profiles')
    .select('is_super_admin')
    .eq('id', user.id)
    .single()

  const profile = result.data as any
  const error = result.error

  if (error || !profile?.is_super_admin) {
    throw new ApiError('Super Admin access required', 403)
  }

  return user.id
}

export async function auditSuperAdminAction(
  supabase: any,
  userId: string,
  action: string,
  targetType: string | null,
  targetId: string | null,
  details: any
): Promise<void> {
  try {
    await supabase.from('super_admin_audit_log').insert({
      super_admin_id: userId,
      action,
      target_type: targetType,
      target_id: targetId,
      details: details || null,
    })
  } catch (err) {
    console.error('[Audit Log Error]', err)
    // Don't fail the main operation if audit fails
  }
}

export async function getSuperAdminEmail(supabase: any): Promise<string | null> {
  try {
    const { data } = await supabase
      .from('system_settings')
      .select('setting_value')
      .eq('setting_key', 'super_admin_email')
      .single()
    return data?.setting_value?.email || null
  } catch {
    return null
  }
}

export async function isSuperAdminByEmail(supabase: any, email: string): Promise<boolean> {
  const superAdminEmail = await getSuperAdminEmail(supabase)
  return superAdminEmail ? email.toLowerCase() === superAdminEmail.toLowerCase() : false
}

export async function requirePermission(request: Request, permission: TeacherPermissionKey): Promise<{ userId: string; profile: any }> {
  const user = await requireAuth(request)
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, teacher_type, school_id')
    .eq('id', user.id)
    .single()

  if (!profile) throw new ApiError('Profile not found', 404)

  // Owner-tier users (independent teachers, school admins) have all permissions
  if (
    profile.role === 'admin' ||
    (profile.role === 'teacher' && profile.teacher_type === 'independent')
  ) {
    return { userId: user.id, profile }
  }

  // Check the teacher_permissions table for granted permissions
  const { data: perm } = await supabase
    .from('teacher_permissions')
    .select('id')
    .eq('teacher_id', user.id)
    .eq('permission', permission)
    .maybeSingle()

  if (!perm) {
    throw new ApiError(`Permission '${permission}' required`, 403)
  }

  return { userId: user.id, profile }
}
