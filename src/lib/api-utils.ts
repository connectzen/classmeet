import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { User } from '@supabase/supabase-js'

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
