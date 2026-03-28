'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import Avatar from '@/components/ui/Avatar'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Badge from '@/components/ui/Badge'
import {
  Users, Search, ChevronDown, ChevronUp, Trash2, AlertCircle,
  GraduationCap, BookOpen, BarChart3,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

// Types
interface Teacher {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  subjects: string[]
}

interface Student {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: string
  created_at: string
  status?: 'active' | 'inactive' | 'pending'
  enrolled_at?: string
}

interface TeacherWithStudents extends Teacher {
  students: Student[]
  studentCount: number
}

interface StudentDetailModalProps {
  student: Student | null
  teacher?: Teacher
  onClose: () => void
  onAssign?: (teacherId: string) => void
  onRemove?: () => void
  allTeachers: Teacher[]
  isUnassigned: boolean
}

// Student Detail Modal
function StudentDetailModal({ student, onClose, onAssign, onRemove, allTeachers, isUnassigned }: StudentDetailModalProps) {
  if (!student) return null
  const [selectedTeacherId, setSelectedTeacherId] = useState('')

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.5)',
          backdropFilter: 'blur(2px)',
          zIndex: 'var(--z-modal)',
          cursor: 'pointer',
        }}
        onClick={onClose}
      />
      {/* Modal */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          background: 'var(--bg-card)',
          border: '1px solid var(--border-default)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px',
          maxWidth: '400px',
          width: '90%',
          zIndex: 'calc(var(--z-modal) + 1)',
          boxShadow: 'var(--shadow-lg)',
        }}
        onClick={e => e.stopPropagation()}
      >
        <h2 style={{ margin: '0 0 12px', fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          Student Details
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px', padding: '12px', background: 'var(--bg-elevated)', borderRadius: 'var(--radius-md)' }}>
          <Avatar src={student.avatar_url} name={student.full_name} size="md" />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{student.full_name || '(No name)'}</div>
            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Joined {new Date(student.created_at).toLocaleDateString()}
            </div>
          </div>
        </div>

        {student.status && [!isUnassigned] && (
          <div style={{ marginBottom: '12px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Status: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{student.status}</span>
          </div>
        )}

        {isUnassigned && (
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Assign to Teacher
            </label>
            <select
              value={selectedTeacherId}
              onChange={e => setSelectedTeacherId(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--border-default)',
                background: 'var(--bg-elevated)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
              }}
            >
              <option value="">Select a teacher...</option>
              {allTeachers.map(t => (
                <option key={t.id} value={t.id}>{t.full_name || '(No name)'}</option>
              ))}
            </select>
          </div>
        )}

        <div style={{ display: 'flex', gap: '8px' }}>
          {isUnassigned && selectedTeacherId && (
            <Button
              size="sm"
              onClick={() => {
                if (onAssign) onAssign(selectedTeacherId)
                onClose()
              }}
            >
              Assign
            </Button>
          )}
          {!isUnassigned && onRemove && (
            <Button
              variant="danger"
              size="sm"
              onClick={() => {
                onRemove()
                onClose()
              }}
            >
              <Trash2 size={14} /> Remove
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </>
  )
}

// Unassigned Students Section
function UnassignedStudentsSection({ students, allTeachers, onAssign }: {
  students: Student[]
  allTeachers: Teacher[]
  onAssign: (studentId: string, teacherId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)

  const filtered = useMemo(() =>
    students.filter(s => s.full_name?.toLowerCase().includes(search.toLowerCase())),
    [students, search]
  )

  return (
    <div style={{ marginBottom: '32px' }}>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={18} color='#f59e0b' />
        Unassigned Students ({students.length})
      </h2>

      {students.length > 0 ? (
        <>
          <Input
            placeholder="Search unassigned students..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            leftIcon={<Search size={14} />}
            style={{ marginBottom: '12px' }}
          />

          {filtered.length > 0 ? (
            <div style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-lg)',
              overflow: 'hidden',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Joined</th>
                    <th style={{ padding: '12px 14px', textAlign: 'left', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Assign To</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(s => (
                    <tr key={s.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                      <td style={{ padding: '12px 14px', cursor: 'pointer' }} onClick={() => setSelectedStudent(s)}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <Avatar src={s.avatar_url} name={s.full_name} size="sm" />
                          <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{s.full_name || '(No name)'}</span>
                        </div>
                      </td>
                      <td style={{ padding: '12px 14px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(s.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ padding: '12px 14px' }}>
                        <select
                          defaultValue=""
                          onChange={e => {
                            if (e.target.value) {
                              onAssign(s.id, e.target.value)
                            }
                          }}
                          onClick={(e) => e.stopPropagation()}
                          style={{
                            padding: '4px 8px',
                            fontSize: '0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            border: '1px solid var(--border-default)',
                            background: 'var(--bg-elevated)',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                          }}
                        >
                          <option value="">Select...</option>
                          {allTeachers.map(t => (
                            <option key={t.id} value={t.id}>{t.full_name || '(No name)'}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
              No results found
            </div>
          )}
        </>
      ) : (
        <div style={{ padding: '20px', background: 'rgba(34, 197, 94, 0.08)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--success-400)', fontWeight: 600 }}>
          ✓ All students are assigned!
        </div>
      )}

      {selectedStudent && (
        <StudentDetailModal
          student={selectedStudent}
          onClose={() => setSelectedStudent(null)}
          onAssign={(teacherId) => onAssign(selectedStudent.id, teacherId)}
          allTeachers={allTeachers}
          isUnassigned={true}
        />
      )}
    </div>
  )
}

// Teachers Section
function TeachersSection({ teachersWithStudents, onRemoveStudent }: {
  teachersWithStudents: TeacherWithStudents[]
  onRemoveStudent: (studentId: string, teacherId: string) => void
}) {
  const [search, setSearch] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<Teacher | null>(null)

  const filtered = useMemo(() =>
    teachersWithStudents.filter(t => t.full_name?.toLowerCase().includes(search.toLowerCase())),
    [teachersWithStudents, search]
  )

  const toggleExpand = (teacherId: string) => {
    const newExpanded = new Set(expanded)
    if (newExpanded.has(teacherId)) {
      newExpanded.delete(teacherId)
    } else {
      newExpanded.add(teacherId)
    }
    setExpanded(newExpanded)
  }

  return (
    <div>
      <h2 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <GraduationCap size={18} />
        Teachers ({teachersWithStudents.length})
      </h2>

      <Input
        placeholder="Search teachers..."
        value={search}
        onChange={e => setSearch(e.target.value)}
        leftIcon={<Search size={14} />}
        style={{ marginBottom: '12px' }}
      />

      {filtered.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {filtered.map(teacher => {
            const isExpanded = expanded.has(teacher.id)
            return (
              <div
                key={teacher.id}
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 'var(--radius-lg)',
                  overflow: 'hidden',
                }}
              >
                {/* Teacher Header */}
                <div
                  onClick={() => toggleExpand(teacher.id)}
                  style={{
                    padding: '14px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    background: 'var(--bg-elevated)',
                    transition: 'background var(--transition-fast)',
                  }}
                  onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)' }}
                  onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'var(--bg-elevated)' }}
                >
                  {isExpanded ? <ChevronUp size={18} color='var(--primary-500)' /> : <ChevronDown size={18} color='var(--text-muted)' />}
                  <Avatar src={teacher.avatar_url} name={teacher.full_name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      {teacher.full_name || '(No name)'}
                      {teacher.subjects && teacher.subjects.length > 0 && (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {teacher.subjects.slice(0, 2).join(', ')}
                        </span>
                      )}
                    </div>
                  </div>
                  <Badge variant="info">{`${teacher.studentCount} ${teacher.studentCount === 1 ? 'Student' : 'Students'}`}</Badge>
                </div>

                {/* Students List (when expanded) */}
                {isExpanded && teacher.students.length > 0 && (
                  <div style={{ borderTop: '1px solid var(--border-default)' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Student</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Enrolled</th>
                          <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</th>
                          <th style={{ padding: '10px 14px', textAlign: 'center', fontSize: '0.7rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {teacher.students.map(student => (
                          <tr key={student.id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                            <td style={{ padding: '10px 14px', cursor: 'pointer' }} onClick={() => { setSelectedStudent(student); setSelectedTeacher(teacher) }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Avatar src={student.avatar_url} name={student.full_name} size="xs" />
                                <span style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.85rem' }}>{student.full_name || '(No name)'}</span>
                              </div>
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                              {student.enrolled_at ? new Date(student.enrolled_at).toLocaleDateString() : '—'}
                            </td>
                            <td style={{ padding: '10px 14px', fontSize: '0.75rem' }}>
                              <span style={{
                                padding: '2px 6px',
                                borderRadius: '12px',
                                background: student.status === 'active' ? 'rgba(34, 197, 94, 0.15)' : 'rgba(156, 163, 175, 0.15)',
                                color: student.status === 'active' ? '#22c55e' : '#9ca3af',
                                fontWeight: 600,
                              }}>
                                {student.status || 'unknown'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                              <button
                                onClick={() => onRemoveStudent(student.id, teacher.id)}
                                title="Remove student"
                                style={{
                                  width: 24,
                                  height: 24,
                                  border: 'none',
                                  borderRadius: 'var(--radius-sm)',
                                  background: 'rgba(239, 68, 68, 0.1)',
                                  color: '#ef4444',
                                  cursor: 'pointer',
                                  display: 'flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  transition: 'background var(--transition-fast)',
                                }}
                                onMouseOver={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.2)' }}
                                onMouseOut={(e) => { (e.currentTarget as HTMLElement).style.background = 'rgba(239, 68, 68, 0.1)' }}
                              >
                                <Trash2 size={12} />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {isExpanded && teacher.students.length === 0 && (
                  <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                    No students assigned
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ) : (
        <div style={{ padding: '20px', background: 'var(--bg-card)', borderRadius: 'var(--radius-lg)', textAlign: 'center', color: 'var(--text-muted)' }}>
          No teachers found
        </div>
      )}

      {selectedStudent && selectedTeacher && (
        <StudentDetailModal
          student={selectedStudent}
          teacher={selectedTeacher}
          onClose={() => setSelectedStudent(null)}
          onRemove={() => onRemoveStudent(selectedStudent.id, selectedTeacher.id)}
          allTeachers={[]}
          isUnassigned={false}
        />
      )}
    </div>
  )
}

// Main AdminDashboard Component
export default function AdminDashboard() {
  const supabase = createClient()
  const toast = useToast()

  const [teachers, setTeachers] = useState<Teacher[]>([])
  const [allStudents, setAllStudents] = useState<Student[]>([])
  const [unassignedStudents, setUnassignedStudents] = useState<Student[]>([])
  const [teachersWithStudents, setTeachersWithStudents] = useState<TeacherWithStudents[]>([])
  const [stats, setStats] = useState({ totalTeachers: 0, totalStudents: 0, unassignedCount: 0, totalCourses: 0 })
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      // Get all teachers
      const { data: teachersData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, subjects')
        .in('role', ['teacher', 'admin'])
        .order('full_name', { ascending: true })

      if (teachersData) {
        setTeachers(teachersData as Teacher[])
      }

      // Get all students
      const { data: studentsData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role, created_at')
        .eq('role', 'student')
        .order('full_name', { ascending: true })

      if (studentsData) {
        setAllStudents(studentsData as Student[])

        // Get all assigned student IDs
        const { data: assignedData } = await supabase
          .from('teacher_students')
          .select('student_id')

        const assignedIds = new Set(assignedData?.map(r => r.student_id) || [])
        const unassigned = studentsData.filter(s => !assignedIds.has(s.id))
        setUnassignedStudents(unassigned as Student[])

        // Get student enrollment details for teachers
        const { data: enrollmentsData } = await supabase
          .from('teacher_students')
          .select('teacher_id, student_id, status, enrolled_at')

        const enrollmentsByTeacher = new Map<string, typeof enrollmentsData>()
        enrollmentsData?.forEach(e => {
          if (!enrollmentsByTeacher.has(e.teacher_id)) {
            enrollmentsByTeacher.set(e.teacher_id, [])
          }
          enrollmentsByTeacher.get(e.teacher_id)!.push(e)
        })

        // Build teachers with students
        const teachersWithStudents = teachersData!.map(teacher => {
          const enrollments = enrollmentsByTeacher.get(teacher.id) || []
          const students = enrollments
            .map(e => {
              const student = studentsData.find(s => s.id === e.student_id)
              return student ? { ...student, status: e.status as 'active' | 'inactive' | 'pending', enrolled_at: e.enrolled_at } : null
            })
            .filter((s): s is Student => s !== null)
          return { ...teacher, students, studentCount: students.length }
        })

        setTeachersWithStudents(teachersWithStudents)

        // Update stats
        setStats({
          totalTeachers: teachersData.length,
          totalStudents: studentsData.length,
          unassignedCount: unassigned.length,
          totalCourses: 0, // Will be set below
        })

        // Get course count
        const { count: courseCount } = await supabase
          .from('courses')
          .select('*', { count: 'exact', head: true })

        setStats(prev => ({ ...prev, totalCourses: courseCount || 0 }))
      }
    } catch (err) {
      console.error('Error loading admin dashboard data:', err)
      toast.error('Failed to load dashboard data')
    } finally {
      setLoading(false)
    }
  }, [supabase, toast])

  // Initial load
  useEffect(() => {
    loadData()
  }, [loadData])

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('admin-dashboard')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'teacher_students',
      }, () => {
        loadData()
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'profiles',
        filter: "role=eq.student",
      }, () => {
        loadData()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, loadData])

  const handleAssign = async (studentId: string, teacherId: string) => {
    try {
      const res = await fetch('/api/admin/assign-student', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, teacherId }),
      })
      if (res.ok) {
        toast.success('Student assigned successfully!')
        loadData()
      } else {
        toast.error('Failed to assign student')
      }
    } catch (err) {
      console.error('Error assigning student:', err)
      toast.error('Error assigning student')
    }
  }

  const handleRemove = async (studentId: string, teacherId: string) => {
    if (!confirm('Remove this student from this teacher\'s classroom?')) return
    try {
      const res = await fetch('/api/admin/remove-student', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ studentId, teacherId }),
      })
      if (res.ok) {
        toast.success('Student removed successfully!')
        loadData()
      } else {
        toast.error('Failed to remove student')
      }
    } catch (err) {
      console.error('Error removing student:', err)
      toast.error('Error removing student')
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
        Loading admin dashboard...
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '1200px' }}>
      {/* Header */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '1.8rem', fontWeight: 800, color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Admin Dashboard
        </h1>
        <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.9rem' }}>
          Manage teachers, students, and system overview
        </p>
      </div>

      {/* Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', marginBottom: '32px' }}>
        {[
          { label: 'Teachers', value: stats.totalTeachers, color: '#3b82f6' },
          { label: 'Students', value: stats.totalStudents, color: '#22c55e' },
          { label: 'Unassigned', value: stats.unassignedCount, color: '#f59e0b' },
          { label: 'Courses', value: stats.totalCourses, color: '#a855f7' },
        ].map(stat => (
          <div key={stat.label} style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-lg)',
            padding: '16px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}>
            <div style={{ width: 40, height: 40, borderRadius: '10px', background: `${stat.color}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: stat.color }}>
              {stat.label === 'Teachers' && <GraduationCap size={20} />}
              {stat.label === 'Students' && <Users size={20} />}
              {stat.label === 'Unassigned' && <AlertCircle size={20} />}
              {stat.label === 'Courses' && <BookOpen size={20} />}
            </div>
            <div>
              <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)' }}>{stat.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{stat.label}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Unassigned Students */}
      <UnassignedStudentsSection
        students={unassignedStudents}
        allTeachers={teachers}
        onAssign={handleAssign}
      />

      {/* Teachers with Students */}
      <TeachersSection
        teachersWithStudents={teachersWithStudents}
        onRemoveStudent={handleRemove}
      />
    </div>
  )
}
