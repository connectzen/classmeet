'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSchool } from '@/lib/school-context'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import {
  Users, GraduationCap, BookOpen, Settings,
  ArrowRight, School,
} from 'lucide-react'
import Link from 'next/link'

interface Stats {
  teacherCount: number
  studentCount: number
  classCount: number
}

interface QuickAction {
  label: string
  desc: string
  icon: React.ElementType
  color: string
  href: string
}

export default function AdminDashboardPage() {
  const school = useSchool()
  const user = useAppStore((s) => s.user)
  const [stats, setStats] = useState<Stats>({ teacherCount: 0, studentCount: 0, classCount: 0 })
  const [loading, setLoading] = useState(true)

  const loadStats = useCallback(async () => {
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
  }, [school.schoolId])

  useEffect(() => { loadStats() }, [loadStats])

  // Real-time updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('admin-page-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'classes' }, () => loadStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'teacher_students' }, () => loadStats())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [loadStats])

  const slug = school.schoolSlug

  const quickActions: QuickAction[] = [
    { label: 'Manage Teachers', desc: 'Add & manage teaching staff', icon: Users, color: '#3b82f6', href: `/${slug}/admin/teachers` },
    { label: 'Manage Students', desc: 'Enroll & assign students', icon: GraduationCap, color: '#22c55e', href: `/${slug}/admin/students` },
    { label: 'Manage Classes', desc: 'Create & organize classes', icon: BookOpen, color: '#a855f7', href: `/${slug}/admin/classes` },
    { label: 'School Settings', desc: 'Configure your school', icon: Settings, color: '#f59e0b', href: `/${slug}/admin/settings` },
  ]

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', margin: '0 auto' }}>
      {/* Welcome Banner */}
      <div style={{
        background: 'linear-gradient(135deg, var(--primary-600) 0%, var(--primary-400) 100%)',
        borderRadius: 'var(--radius-lg)',
        padding: '28px 32px',
        marginBottom: '28px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '16px',
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <School size={22} color="rgba(255,255,255,0.85)" />
            <h1 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#fff' }}>
              {school.schoolName}
            </h1>
          </div>
          <p style={{ margin: 0, color: 'rgba(255,255,255,0.75)', fontSize: '0.88rem' }}>
            Welcome back, {user?.fullName ?? 'Admin'} — here&apos;s your school overview.
          </p>
        </div>
        <Link
          href={`/${slug}/admin/settings`}
          className="btn btn-sm"
          style={{
            background: 'rgba(255,255,255,0.2)',
            color: '#fff',
            border: '1px solid rgba(255,255,255,0.3)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 16px',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            textDecoration: 'none',
            fontSize: '0.82rem',
            fontWeight: 500,
            backdropFilter: 'blur(4px)',
          }}
        >
          <Settings size={14} /> Settings
        </Link>
      </div>

      {/* Quick Actions */}
      <h2 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px' }}>
        Quick Actions
      </h2>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px',
      }}>
        {quickActions.map((action) => {
          const Icon = action.icon
          return (
            <Link key={action.label} href={action.href} style={{ textDecoration: 'none' }}>
              <div className="card card-interactive" style={{ padding: '18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  background: `${action.color}18`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                }}>
                  <Icon size={20} color={action.color} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>{action.label}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{action.desc}</div>
                </div>
                <ArrowRight size={15} color="var(--text-disabled)" />
              </div>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
