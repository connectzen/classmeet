'use client'

import type { ReactNode } from 'react'
import { SchoolProvider, type SchoolContextValue } from '@/lib/school-context'

interface Props {
  value: SchoolContextValue
  children: ReactNode
}

export function SchoolHydrator({ value, children }: Props) {
  return <SchoolProvider value={value}>{children}</SchoolProvider>
}
