'use client'

import { useState, useCallback, useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import {
  BookOpen, Plus, GraduationCap, X, Users, Clock, Search,
  ChevronDown, ChevronRight, GripVertical, Trash2, FileText,
  Video, Save, ArrowLeft, Eye, EyeOff, FolderOpen, Check,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { processLessonImages, cleanupOrphanedImages } from '@/lib/image-sync'

const RichTextEditor = dynamic(() => import('@/components/editor/RichTextEditor'), { ssr: false })

// ── Types ─────────────────────────────────────────────────────────────────────
interface LessonLocal {
  id: string; title: string; type: 'text' | 'video'; content: string
  videoUrl: string; sortOrder: number; collapsed: boolean
}
interface TopicLocal {
  id: string; title: string; sortOrder: number; collapsed: boolean
  lessons: LessonLocal[]
}
interface CourseLocal {
  id: string; title: string; description: string; subject: string
  level: string; teacherId: string; teacherName: string
  published: boolean; createdAt: string
  topics: TopicLocal[]
}

const SUBJECTS = ['Mathematics', 'Science', 'English', 'History', 'Computer Science', 'Art', 'Music', 'Physical Education', 'Other']
const LEVELS = ['Beginner', 'Intermediate', 'Advanced', 'All Levels']
const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }, [])
  return { toast, show }
}

interface GroupOption { id: string; name: string; memberCount: number }
interface StudentOption { id: string; name: string; avatarUrl: string | null }

// ── Sortable Topic ────────────────────────────────────────────────────────────
function SortableTopic({ topic, onUpdate, onRemove, onAddLesson, onUpdateLesson, onRemoveLesson, onReorderLessons }: {
  topic: TopicLocal
  onUpdate: (id: string, updates: Partial<TopicLocal>) => void
  onRemove: (id: string) => void
  onAddLesson: (topicId: string) => void
  onUpdateLesson: (topicId: string, lessonId: string, updates: Partial<LessonLocal>) => void
  onRemoveLesson: (topicId: string, lessonId: string) => void
  onReorderLessons: (topicId: string, oldIndex: number, newIndex: number) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: topic.id })
  const style = { transform: CSS.Transform.toString(transform), transition }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function handleLessonDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = topic.lessons.findIndex(l => l.id === active.id)
      const newIndex = topic.lessons.findIndex(l => l.id === over.id)
      onReorderLessons(topic.id, oldIndex, newIndex)
    }
  }

  return (
    <div ref={setNodeRef} style={style} className="card" key={topic.id}
      data-topic-wrapper=""
      >
      {/* Topic header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', cursor: 'pointer', borderBottom: topic.collapsed ? 'none' : '1px solid var(--border-subtle)' }}
        onClick={() => onUpdate(topic.id, { collapsed: !topic.collapsed })}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex' }}
          onClick={e => e.stopPropagation()}>
          <GripVertical size={16} />
        </span>
        {topic.collapsed ? <ChevronRight size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        <input
          value={topic.title}
          onChange={e => { e.stopPropagation(); onUpdate(topic.id, { title: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          placeholder="Topic title…"
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', outline: 'none' }}
        />
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
          {topic.lessons.length} lesson{topic.lessons.length !== 1 ? 's' : ''}
        </span>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(topic.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 4, display: 'flex' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Lessons */}
      {!topic.collapsed && (
        <div style={{ padding: '8px 16px 16px' }}>
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleLessonDragEnd}>
            <SortableContext items={topic.lessons.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {topic.lessons.map(lesson => (
                <SortableLesson
                  key={lesson.id}
                  lesson={lesson}
                  onUpdate={(lid, updates) => onUpdateLesson(topic.id, lid, updates)}
                  onRemove={(lid) => onRemoveLesson(topic.id, lid)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button type="button" onClick={() => onAddLesson(topic.id)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 12px', width: '100%', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--text-muted)', fontSize: '0.82rem', cursor: 'pointer', marginTop: topic.lessons.length > 0 ? '8px' : 0 }}>
            <Plus size={14} /> Add Lesson
          </button>
        </div>
      )}
    </div>
  )
}

// ── Sortable Lesson ────────────────────────────────────────────────────────
function SortableLesson({ lesson, onUpdate, onRemove }: {
  lesson: LessonLocal
  onUpdate: (id: string, updates: Partial<LessonLocal>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: lesson.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

  return (
    <div ref={setNodeRef} style={{ ...style, border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '8px', background: 'var(--bg-secondary)' }}>
      {/* Lesson header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 12px', cursor: 'pointer', borderBottom: lesson.collapsed ? 'none' : '1px solid var(--border-subtle)' }}
        onClick={() => onUpdate(lesson.id, { collapsed: !lesson.collapsed })}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex' }}
          onClick={e => e.stopPropagation()}>
          <GripVertical size={14} />
        </span>
        {lesson.type === 'video' ? <Video size={14} color="#8b5cf6" /> : <FileText size={14} color="#6366f1" />}
        {lesson.collapsed ? <ChevronRight size={14} color="var(--text-muted)" /> : <ChevronDown size={14} color="var(--text-muted)" />}
        <input
          value={lesson.title}
          onChange={e => { e.stopPropagation(); onUpdate(lesson.id, { title: e.target.value }) }}
          onClick={e => e.stopPropagation()}
          placeholder="Lesson title…"
          style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-primary)', outline: 'none' }}
        />
        <select value={lesson.type} onClick={e => e.stopPropagation()}
          onChange={e => { e.stopPropagation(); onUpdate(lesson.id, { type: e.target.value as 'text' | 'video' }) }}
          style={{ background: 'var(--bg-primary)', border: '1px solid var(--border-default)', borderRadius: 'var(--radius-sm)', fontSize: '0.72rem', padding: '2px 6px', color: 'var(--text-secondary)', cursor: 'pointer' }}>
          <option value="text">Text</option>
          <option value="video">Video</option>
        </select>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(lesson.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 4, display: 'flex' }}>
          <Trash2 size={13} />
        </button>
      </div>

      {/* Lesson content editor */}
      {!lesson.collapsed && (
        <div style={{ padding: '12px' }}>
          {lesson.type === 'video' ? (
            <Input
              placeholder="Paste video URL (YouTube, Vimeo, etc.)"
              value={lesson.videoUrl}
              onChange={e => onUpdate(lesson.id, { videoUrl: e.target.value })}
              leftIcon={<Video size={14} />}
            />
          ) : (
            <RichTextEditor
              content={lesson.content}
              onChange={html => onUpdate(lesson.id, { content: html })}
            />
          )}
        </div>
      )}
    </div>
  )
}

// ── Course Card ─────────────────────────────────────────────────────────────
function CourseCard({ course, onClick, onDelete }: { course: CourseLocal; onClick: () => void; onDelete: () => void }) {
  const subjectColors: Record<string, string> = {
    Mathematics: '#6366f1', Science: '#10b981', English: '#f59e0b', History: '#ef4444',
    'Computer Science': '#8b5cf6', Art: '#ec4899', Music: '#14b8a6', 'Physical Education': '#f97316', Other: '#64748b',
  }
  const color = subjectColors[course.subject] || '#6366f1'
  const totalLessons = course.topics.reduce((sum, t) => sum + t.lessons.length, 0)

  return (
    <div className="card" style={{ padding: '20px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: `${color}20`, color, border: `1px solid ${color}30` }}>{course.subject}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {course.published ? <Eye size={12} color="#22c55e" /> : <EyeOff size={12} color="var(--text-muted)" />}
          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{course.level}</span>
          <button type="button" onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 2, display: 'flex' }}
            title="Delete course">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{course.title}</h3>
      <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, minHeight: '2.8em' }}>
        {course.description || 'No description provided.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <BookOpen size={12} /> {course.topics.length} topic{course.topics.length !== 1 ? 's' : ''} · {totalLessons} lesson{totalLessons !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {new Date(course.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ───────────────────────────────────────────────────────────────
export default function CoursesPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [courses, setCourses] = useState<CourseLocal[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [editing, setEditing] = useState<CourseLocal | null>(null)

  // Targeting state
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [students, setStudents] = useState<StudentOption[]>([])
  const [targetMode, setTargetMode] = useState<'groups' | 'students'>('groups')
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [targetSearch, setTargetSearch] = useState('')

  const isCreator = user?.role === 'teacher' || user?.role === 'member' || user?.role === 'admin'
  const supabase = createClient()

  // ─ Load courses ─
  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    async function load() {
      const { data: coursesData } = await supabase
        .from('courses')
        .select('*')
        .eq('teacher_id', user!.id)
        .order('created_at', { ascending: false })

      if (coursesData) {
        const full: CourseLocal[] = []
        for (const c of coursesData) {
          const { data: topicsData } = await supabase
            .from('topics').select('*').eq('course_id', c.id).order('sort_order')
          const topics: TopicLocal[] = []
          for (const t of (topicsData || [])) {
            const { data: lessonsData } = await supabase
              .from('lessons').select('*').eq('topic_id', t.id).order('sort_order')
            topics.push({
              id: t.id, title: t.title, sortOrder: t.sort_order, collapsed: true,
              lessons: (lessonsData || []).map(l => ({
                id: l.id, title: l.title, type: l.type as 'text' | 'video',
                content: l.content || '', videoUrl: l.video_url || '',
                sortOrder: l.sort_order, collapsed: true,
              })),
            })
          }
          full.push({
            id: c.id, title: c.title, description: c.description || '',
            subject: c.subject, level: c.level, teacherId: c.teacher_id,
            teacherName: user!.fullName || 'Teacher', published: c.published,
            createdAt: c.created_at, topics,
          })
        }
        setCourses(full)
      }
      setLoading(false)
    }
    load()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // ─ Load groups + students for targeting ─
  useEffect(() => {
    if (!user?.id || !isCreator) return
    async function loadTargets() {
      // Groups
      const { data: grps } = await supabase.from('groups').select('id, name').eq('teacher_id', user!.id)
      if (grps) {
        const groupsWithCount: GroupOption[] = []
        for (const g of grps) {
          const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
          groupsWithCount.push({ id: g.id, name: g.name, memberCount: count || 0 })
        }
        setGroups(groupsWithCount)
      }
      // Students
      const { data: enrolled } = await supabase.from('teacher_students').select('student_id').eq('teacher_id', user!.id).eq('status', 'active')
      if (enrolled && enrolled.length > 0) {
        const ids = enrolled.map(e => e.student_id)
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
        if (profiles) setStudents(profiles.map(p => ({ id: p.id, name: p.full_name || 'Student', avatarUrl: p.avatar_url })))
      }
    }
    loadTargets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCreator])

  // ─ Load targets when opening a course for editing ─
  useEffect(() => {
    if (!editing) return
    async function loadCourseTargets() {
      const { data: targets } = await supabase.from('course_targets').select('*').eq('course_id', editing!.id)
      if (targets && targets.length > 0) {
        const first = targets[0]
        if (first.target_type === 'group') {
          setTargetMode('groups')
          setSelectedGroups(new Set(targets.map(t => t.target_id)))
          setSelectedStudents(new Set())
        } else {
          setTargetMode('students')
          setSelectedStudents(new Set(targets.map(t => t.target_id)))
          setSelectedGroups(new Set())
        }
      } else {
        setSelectedGroups(new Set())
        setSelectedStudents(new Set())
      }
    }
    loadCourseTargets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id])

  // ─ Delete course (with image cleanup) ─
  async function deleteCourse(courseId: string) {
    if (!confirm('Delete this course, all its lessons, and uploaded images?')) return
    try {
      // Delete all uploaded images from storage for this course
      const { data: files } = await supabase.storage.from('lesson-images').list(`${user!.id}/${courseId}`)
      if (files && files.length > 0) {
        const paths = files.map(f => `${user!.id}/${courseId}/${f.name}`)
        await supabase.storage.from('lesson-images').remove(paths)
      }
      // Delete course (cascade deletes topics, lessons, course_targets)
      await supabase.from('courses').delete().eq('id', courseId)
      setCourses(prev => prev.filter(c => c.id !== courseId))
      if (editing?.id === courseId) setEditing(null)
      showToast('✅ Course deleted')
    } catch {
      showToast('❌ Failed to delete course')
    }
  }

  // ─ Create new course ─
  async function createCourse() {
    if (!user?.id) return
    const { data, error } = await supabase.from('courses').insert({
      teacher_id: user.id, title: 'Untitled Course', description: '', subject: 'Other', level: 'All Levels',
    }).select().single()
    if (error || !data) { showToast('❌ Failed to create course'); return }
    const newCourse: CourseLocal = {
      id: data.id, title: data.title, description: data.description || '',
      subject: data.subject, level: data.level, teacherId: data.teacher_id,
      teacherName: user.fullName || 'Teacher', published: data.published,
      createdAt: data.created_at, topics: [],
    }
    setCourses(prev => [newCourse, ...prev])
    setEditing(newCourse)
  }

  // ─ Save course (full persist) ─
  async function saveCourse() {
    if (!editing || !user?.id) return
    setSaving(true)
    try {
      // ── Process images: upload blob URLs → real URLs, delete orphans ──
      const updatedTopics = [...editing.topics.map(t => ({ ...t, lessons: t.lessons.map(l => ({ ...l })) }))]
      const allLessonHtmls: string[] = []
      for (const topic of updatedTopics) {
        for (const lesson of topic.lessons) {
          if (lesson.type === 'text' && lesson.content) {
            lesson.content = await processLessonImages(lesson.content, editing.id, user.id, supabase)
          }
          allLessonHtmls.push(lesson.content || '')
        }
      }
      await cleanupOrphanedImages(allLessonHtmls, editing.id, user.id, supabase)

      // Update local state with resolved URLs
      const editingResolved = { ...editing, topics: updatedTopics }
      setEditing(editingResolved)

      // Update course meta
      await supabase.from('courses').update({
        title: editingResolved.title, description: editingResolved.description,
        subject: editingResolved.subject, level: editingResolved.level, published: editingResolved.published,
      }).eq('id', editingResolved.id)

      // Delete old topics/lessons and re-insert (simplest for reorder)
      const { data: oldTopics } = await supabase.from('topics').select('id').eq('course_id', editingResolved.id)
      if (oldTopics) {
        for (const ot of oldTopics) {
          await supabase.from('lessons').delete().eq('topic_id', ot.id)
        }
        await supabase.from('topics').delete().eq('course_id', editingResolved.id)
      }

      // Insert topics + lessons
      for (let ti = 0; ti < editingResolved.topics.length; ti++) {
        const t = editingResolved.topics[ti]
        const { data: topicRow } = await supabase.from('topics').insert({
          course_id: editingResolved.id, title: t.title, sort_order: ti,
        }).select().single()
        if (topicRow) {
          for (let li = 0; li < t.lessons.length; li++) {
            const l = t.lessons[li]
            await supabase.from('lessons').insert({
              topic_id: topicRow.id, title: l.title, type: l.type,
              content: l.content, video_url: l.videoUrl || null, sort_order: li,
            })
          }
        }
      }

      // Update local courses list
      setCourses(prev => prev.map(c => c.id === editingResolved.id ? editingResolved : c))

      // ─ Persist course targets ─
      await supabase.from('course_targets').delete().eq('course_id', editingResolved.id)
      const targets: { course_id: string; target_type: 'group' | 'student'; target_id: string }[] = targetMode === 'groups'
        ? Array.from(selectedGroups).map(gid => ({ course_id: editingResolved.id, target_type: 'group' as const, target_id: gid }))
        : Array.from(selectedStudents).map(sid => ({ course_id: editingResolved.id, target_type: 'student' as const, target_id: sid }))
      if (targets.length > 0) await supabase.from('course_targets').insert(targets)

      showToast('✅ Course saved successfully!')
    } catch {
      showToast('❌ Failed to save course')
    }
    setSaving(false)
  }

  // ─ Topic helpers ─
  function addTopic() {
    if (!editing) return
    setEditing({
      ...editing,
      topics: [...editing.topics, { id: uid(), title: '', sortOrder: editing.topics.length, collapsed: false, lessons: [] }],
    })
  }
  function updateTopic(id: string, updates: Partial<TopicLocal>) {
    if (!editing) return
    setEditing({ ...editing, topics: editing.topics.map(t => t.id === id ? { ...t, ...updates } : t) })
  }
  function removeTopic(id: string) {
    if (!editing) return
    setEditing({ ...editing, topics: editing.topics.filter(t => t.id !== id) })
  }

  // ─ Lesson helpers ─
  function addLesson(topicId: string) {
    if (!editing) return
    setEditing({
      ...editing,
      topics: editing.topics.map(t => t.id === topicId ? {
        ...t,
        lessons: [...t.lessons, { id: uid(), title: '', type: 'text' as const, content: '', videoUrl: '', sortOrder: t.lessons.length, collapsed: false }],
      } : t),
    })
  }
  function updateLesson(topicId: string, lessonId: string, updates: Partial<LessonLocal>) {
    if (!editing) return
    setEditing({
      ...editing,
      topics: editing.topics.map(t => t.id === topicId ? {
        ...t,
        lessons: t.lessons.map(l => l.id === lessonId ? { ...l, ...updates } : l),
      } : t),
    })
  }
  function removeLesson(topicId: string, lessonId: string) {
    if (!editing) return
    setEditing({
      ...editing,
      topics: editing.topics.map(t => t.id === topicId ? {
        ...t, lessons: t.lessons.filter(l => l.id !== lessonId),
      } : t),
    })
  }
  function reorderLessons(topicId: string, oldIndex: number, newIndex: number) {
    if (!editing) return
    setEditing({
      ...editing,
      topics: editing.topics.map(t => t.id === topicId ? {
        ...t, lessons: arrayMove(t.lessons, oldIndex, newIndex),
      } : t),
    })
  }

  // ─ DnD for topics ─
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )
  function handleTopicDragEnd(event: DragEndEvent) {
    if (!editing) return
    const { active, over } = event
    if (over && active.id !== over.id) {
      const oldIndex = editing.topics.findIndex(t => t.id === active.id)
      const newIndex = editing.topics.findIndex(t => t.id === over.id)
      setEditing({ ...editing, topics: arrayMove(editing.topics, oldIndex, newIndex) })
    }
  }

  const filtered = courses.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase()) ||
    c.subject.toLowerCase().includes(search.toLowerCase())
  )

  // ══════════════════════════════════════════════════════════════════════════
  // COURSE BUILDER VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (editing) {
    return (
      <div style={{ maxWidth: '860px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <button type="button" onClick={() => setEditing(null)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            <ArrowLeft size={16} /> Back to Courses
          </button>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} />} onClick={() => deleteCourse(editing.id)}>Delete</Button>
            <Button variant="ghost" icon={editing.published ? <Eye size={14} /> : <EyeOff size={14} />}
              onClick={() => setEditing({ ...editing, published: !editing.published })}>
              {editing.published ? 'Published' : 'Draft'}
            </Button>
            <Button icon={<Save size={14} />} loading={saving} onClick={saveCourse}>Save Course</Button>
          </div>
        </div>

        {/* Course meta */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Course Title" required placeholder="e.g. Introduction to Algebra"
              value={editing.title} onChange={e => setEditing({ ...editing, title: e.target.value })} />
            <div className="input-group">
              <label className="input-label">Description</label>
              <textarea className="input" rows={2} placeholder="What will students learn?"
                value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                style={{ resize: 'vertical', minHeight: '60px' }} />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="input-group">
                <label className="input-label">Subject</label>
                <select className="input" value={editing.subject} onChange={e => setEditing({ ...editing, subject: e.target.value })}>
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="input-group">
                <label className="input-label">Level</label>
                <select className="input" value={editing.level} onChange={e => setEditing({ ...editing, level: e.target.value })}>
                  {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Assignment – assign to groups or students */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Users size={16} color="var(--primary-400)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Assign To</span>
          </div>
          {/* Toggle tabs */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
            <button type="button" onClick={() => { setTargetMode('groups'); setSelectedStudents(new Set()) }}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 500, border: '1px solid var(--border-default)', cursor: 'pointer', background: targetMode === 'groups' ? 'var(--primary-500)' : 'transparent', color: targetMode === 'groups' ? '#fff' : 'var(--text-secondary)' }}>
              <FolderOpen size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Groups
            </button>
            <button type="button" onClick={() => { setTargetMode('students'); setSelectedGroups(new Set()) }}
              style={{ padding: '6px 14px', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 500, border: '1px solid var(--border-default)', cursor: 'pointer', background: targetMode === 'students' ? 'var(--primary-500)' : 'transparent', color: targetMode === 'students' ? '#fff' : 'var(--text-secondary)' }}>
              <Users size={13} style={{ marginRight: 4, verticalAlign: -2 }} /> Students
            </button>
          </div>
          {/* Search */}
          <Input placeholder={targetMode === 'groups' ? 'Search groups…' : 'Search students…'} value={targetSearch} onChange={e => setTargetSearch(e.target.value)} leftIcon={<Search size={14} />} />
          {/* List */}
          <div style={{ maxHeight: '200px', overflowY: 'auto', marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {targetMode === 'groups' ? (
              groups.filter(g => g.name.toLowerCase().includes(targetSearch.toLowerCase())).map(g => (
                <label key={g.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selectedGroups.has(g.id) ? 'rgba(99,102,241,0.12)' : 'transparent' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedGroups.has(g.id) ? 'var(--primary-500)' : 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedGroups.has(g.id) ? 'var(--primary-500)' : 'transparent', flexShrink: 0 }}
                    onClick={() => setSelectedGroups(prev => { const n = new Set(prev); if (n.has(g.id)) n.delete(g.id); else n.add(g.id); return n })}>
                    {selectedGroups.has(g.id) && <Check size={12} color="#fff" />}
                  </div>
                  <FolderOpen size={14} color="var(--primary-400)" />
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{g.name}</span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{g.memberCount} members</span>
                </label>
              ))
            ) : (
              students.filter(s => s.name.toLowerCase().includes(targetSearch.toLowerCase())).map(s => (
                <label key={s.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: 'var(--radius-sm)', cursor: 'pointer', background: selectedStudents.has(s.id) ? 'rgba(99,102,241,0.12)' : 'transparent' }}>
                  <div style={{ width: 18, height: 18, borderRadius: 4, border: `2px solid ${selectedStudents.has(s.id) ? 'var(--primary-500)' : 'var(--border-default)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', background: selectedStudents.has(s.id) ? 'var(--primary-500)' : 'transparent', flexShrink: 0 }}
                    onClick={() => setSelectedStudents(prev => { const n = new Set(prev); if (n.has(s.id)) n.delete(s.id); else n.add(s.id); return n })}>
                    {selectedStudents.has(s.id) && <Check size={12} color="#fff" />}
                  </div>
                  <Avatar src={s.avatarUrl} name={s.name} size="sm" />
                  <span style={{ flex: 1, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{s.name}</span>
                </label>
              ))
            )}
            {targetMode === 'groups' && groups.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No groups created yet</p>
            )}
            {targetMode === 'students' && students.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No enrolled students</p>
            )}
          </div>
          {/* Selection summary */}
          {(selectedGroups.size > 0 || selectedStudents.size > 0) && (
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--primary-400)' }}>
              {targetMode === 'groups' ? `${selectedGroups.size} group(s) selected` : `${selectedStudents.size} student(s) selected`}
            </div>
          )}
        </div>

        {/* Curriculum */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>Curriculum</h2>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addTopic}>Add Topic</Button>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTopicDragEnd}>
          <SortableContext items={editing.topics.map(t => t.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {editing.topics.map(topic => (
                <SortableTopic key={topic.id} topic={topic}
                  onUpdate={updateTopic} onRemove={removeTopic}
                  onAddLesson={addLesson} onUpdateLesson={updateLesson}
                  onRemoveLesson={removeLesson} onReorderLessons={reorderLessons} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {editing.topics.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <BookOpen size={28} color="var(--text-muted)" style={{ marginBottom: '10px' }} />
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>
              No topics yet. Click &quot;Add Topic&quot; to start building your curriculum.
            </p>
          </div>
        )}

        {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  // COURSE LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Courses</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isCreator ? 'Create and manage your course content' : 'Browse available courses'}
          </p>
        </div>
        {isCreator && <Button icon={<Plus size={15} />} onClick={createCourse}>Create Course</Button>}
      </div>

      {/* Search */}
      {courses.length > 0 && (
        <div style={{ marginBottom: '20px' }}>
          <Input placeholder="Search courses…" value={search} onChange={e => setSearch(e.target.value)} leftIcon={<Search size={15} />} />
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="card" style={{ padding: '60px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading courses…</p>
        </div>
      ) : filtered.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filtered.map(c => <CourseCard key={c.id} course={c} onClick={() => setEditing(c)} onDelete={() => deleteCourse(c.id)} />)}
        </div>
      ) : courses.length > 0 && search ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <Search size={28} color="var(--text-muted)" style={{ marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No courses match &quot;{search}&quot;</p>
        </div>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'linear-gradient(135deg, rgba(168,85,247,0.15), rgba(99,102,241,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            {isCreator ? <BookOpen size={28} color="var(--accent-400)" /> : <GraduationCap size={28} color="var(--accent-400)" />}
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No courses yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '340px', marginLeft: 'auto', marginRight: 'auto' }}>
            {isCreator
              ? 'Create your first course to organize lessons and resources for your students.'
              : 'No courses are available yet. Check back soon.'}
          </p>
          {isCreator && <Button icon={<Plus size={15} />} onClick={createCourse}>Create Your First Course</Button>}
        </div>
      )}

      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}