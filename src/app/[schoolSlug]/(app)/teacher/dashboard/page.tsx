'use client'

import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'

export default function TeacherDashboardPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
        Teacher Dashboard
      </h1>
      <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
        Welcome, {user?.fullName} - {school.schoolName}
      </p>
      <p style={{ color: 'var(--text-tertiary)', fontSize: '0.8rem', marginTop: 16 }}>
        Courses, rooms, quizzes, and other features will be available here.
      </p>
    </div>
  )
}
