'use client'

import { useEffect } from 'react'
import { useSchool } from '@/lib/school-context'

export function SchoolThemeProvider({ children }: { children: React.ReactNode }) {
  const school = useSchool()

  useEffect(() => {
    if (school) {
      const root = document.documentElement

      // Set CSS variables for school colors
      if (school.primaryColor) {
        root.style.setProperty('--school-primary', school.primaryColor)
      }

      if (school.secondaryColor) {
        root.style.setProperty('--school-secondary', school.secondaryColor)
      }

      // Optional: Store logo URL in a custom property for use in CSS
      if (school.schoolLogo) {
        root.style.setProperty('--school-logo-url', `url('${school.schoolLogo}')`)
      }
    }
  }, [school])

  return <>{children}</>
}
