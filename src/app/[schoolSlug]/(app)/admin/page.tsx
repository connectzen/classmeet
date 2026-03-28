'use client'

import { useState, useEffect } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import { Users, GraduationCap, BookOpen, UserPlus, School } from 'lucide-react'
import Link from 'next/link'

interface Stats {
  teacherCount: number
  studentCount: number
  classCount: number
}

export default function AdminDashboardPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)
  const [stats, setStats] = useState<Stats>({ teacherCount: 0, studentCount: 0, classCount: 0 })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const supabase = createClient()

      const [teachers, students, classes] = await Promise.all([
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.schoolId).eq('role', 'teacher'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('school_id', school.schoolId).eq('role', 'student'),
        supabase.from('classes').select('id', { count: 'exact', head: true }).eq('school_id', school.schoolId),
      ])

      setStats({
        teacherCount: teachers.count ?? 0,
        studentCount: students.count ?? 0,
        classCount: classes.count ?? 0,
      })
      setLoading(false)
    }
    load()
  }, [school.schoolId])

  const cards = [
    { label: 'Teachers', count: stats.teacherCount, icon: Users, href: `/${school.schoolSlug}/admin/teachers`, color: 'var(--primary-400)' },
    { label: 'Students', count: stats.studentCount, icon: GraduationCap, href: `/${school.schoolSlug}/admin/students`, color: 'var(--success-400)' },
    { label: 'Classes', count: stats.classCount, icon: BookOpen, href: `/${school.schoolSlug}/admin/classes`, color: 'var(--warning-400)' },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {school.schoolName}
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem', marginTop: 4 }}>
          Welcome back, {user?.fullName}
        </p>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '32px' }}>
        {cards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              padding: '20px',
              borderRadius: '12px',
              background: 'var(--card-bg)',
              border: '1px solid var(--border-subtle)',
              textDecoration: 'none',
              transition: 'border-color 0.15s',
            }}
          >
            <div style={{
              width: 44,
              height: 44,
              borderRadius: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: `color-mix(in srgb, ${card.color} 15%, transparent)`,
            }}>
              <card.icon size={22} color={card.color} />
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {loading ? '...' : card.count}
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{card.label}</div>
            </div>
          </Link>
        ))}
      </div>

      {/* Quick actions */}
      <div>
        <h2 style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '16px' }}>Quick Actions</h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <Link
            href={`/${school.schoolSlug}/admin/teachers`}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <UserPlus size={16} /> Add Teacher
          </Link>
          <Link
            href={`/${school.schoolSlug}/admin/students`}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <UserPlus size={16} /> Add Student
          </Link>
          <Link
            href={`/${school.schoolSlug}/admin/classes`}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <BookOpen size={16} /> Create Class
          </Link>
          <Link
            href={`/${school.schoolSlug}/admin/settings`}
            className="btn btn-outline"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
          >
            <School size={16} /> School Settings
          </Link>
        </div>
      </div>
    </div>
  )
}
