'use client'

import { createContext, useContext, type ReactNode } from 'react'

export interface SchoolContextValue {
  schoolId: string
  schoolSlug: string
  schoolName: string
  schoolLogo: string | null
  primaryColor: string
  secondaryColor: string
  /** True when the context represents a teacher workspace, not a school */
  isTeacherWorkspace?: boolean
  /** The teacher who owns this workspace (set when isTeacherWorkspace is true) */
  workspaceOwnerId?: string
}

const SchoolContext = createContext<SchoolContextValue | null>(null)

export function SchoolProvider({
  value,
  children,
}: {
  value: SchoolContextValue
  children: ReactNode
}) {
  return <SchoolContext.Provider value={value}>{children}</SchoolContext.Provider>
}

export function useSchool(): SchoolContextValue {
  const ctx = useContext(SchoolContext)
  if (!ctx) throw new Error('useSchool must be used within a SchoolProvider')
  return ctx
}
