'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import {
  HelpCircle, Plus, Trash2, ArrowLeft, Save, Clock,
  ChevronDown, ChevronRight, Check, X, Type, ToggleLeft, PenLine, FileText,
  Users, Search, FolderOpen,
} from 'lucide-react'
import {
  DndContext, closestCenter, KeyboardSensor, MouseSensor, TouchSensor,
  useSensor, useSensors, type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useToast } from '@/hooks/useToast'

// ── Types ─────────────────────────────────────────────────────────────────────
type QuestionType = 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'

interface QuestionLocal {
  id: string
  questionText: string
  questionType: QuestionType
  options: string[]
  correctIndex: number
  correctAnswer: string
  timeLimit: number
  sortOrder: number
  collapsed: boolean
}

const QUESTION_TYPES: { value: QuestionType; label: string; icon: typeof HelpCircle }[] = [
  { value: 'multiple_choice', label: 'Multiple Choice', icon: HelpCircle },
  { value: 'true_false', label: 'True / False', icon: ToggleLeft },
  { value: 'short_answer', label: 'Short Answer', icon: Type },
  { value: 'fill_blank', label: 'Fill in the Blank', icon: PenLine },
]

interface QuizLocal {
  id: string
  title: string
  description: string
  questionCount: number
  createdAt: string
}

const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ── Sortable Question ─────────────────────────────────────────────────────────
function SortableQuestion({ question, onUpdate, onRemove }: {
  question: QuestionLocal
  onUpdate: (id: string, updates: Partial<QuestionLocal>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: question.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  const [editingTitle, setEditingTitle] = useState(false)
  const [hovered, setHovered] = useState(false)

  function updateOption(idx: number, value: string) {
    const opts = [...question.options]
    opts[idx] = value
    onUpdate(question.id, { options: opts })
  }

  function removeOption(idx: number) {
    if (question.options.length <= 2) return
    const opts = question.options.filter((_, i) => i !== idx)
    const newCorrect = question.correctIndex >= opts.length ? 0 : question.correctIndex > idx ? question.correctIndex - 1 : question.correctIndex === idx ? 0 : question.correctIndex
    onUpdate(question.id, { options: opts, correctIndex: newCorrect })
  }

  function addOption() {
    if (question.options.length >= 6) return
    onUpdate(question.id, { options: [...question.options, ''] })
  }

  function changeType(newType: QuestionType) {
    const updates: Partial<QuestionLocal> = { questionType: newType }
    if (newType === 'true_false') {
      updates.options = ['True', 'False']
      updates.correctIndex = 0
      updates.correctAnswer = ''
    } else if (newType === 'multiple_choice') {
      if (question.options.length < 2) updates.options = ['', '', '', '']
      updates.correctAnswer = ''
    } else if (newType === 'short_answer' || newType === 'fill_blank') {
      updates.options = []
      updates.correctIndex = 0
    }
    onUpdate(question.id, updates)
  }

  const typeInfo = QUESTION_TYPES.find(t => t.value === question.questionType) || QUESTION_TYPES[0]
  const TypeIcon = typeInfo.icon

  return (
    <div ref={setNodeRef} style={style} className="card" key={question.id}>
      {/* Question header — click collapses, double-click title edits, drag anywhere */}
      <div
        {...attributes}
        {...listeners}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={() => onUpdate(question.id, { collapsed: !question.collapsed })}
        style={{
          display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px',
          cursor: 'pointer', userSelect: 'none',
          borderBottom: question.collapsed ? 'none' : '1px solid var(--border-subtle)',
          background: hovered ? 'rgba(0,0,0,0.04)' : 'transparent',
          transition: 'background 0.15s',
        }}
      >
        {question.collapsed ? <ChevronRight size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        {editingTitle ? (
          <input
            autoFocus
            value={question.questionText}
            onChange={e => onUpdate(question.id, { questionText: e.target.value })}
            onPointerDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
            onBlur={() => setEditingTitle(false)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setEditingTitle(false) } }}
            placeholder="Question text…"
            style={{ flex: 1, border: 'none', background: 'transparent', fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', outline: 'none', cursor: 'text' }}
          />
        ) : (
          <span
            onPointerDown={e => e.stopPropagation()}
            onDoubleClick={e => { e.stopPropagation(); setEditingTitle(true) }}
            title="Double-click to edit"
            style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: question.questionText ? 'var(--text-primary)' : 'var(--text-disabled)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}
          >
            {question.questionText || 'Untitled Question'}
          </span>
        )}
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
          <TypeIcon size={11} /> {typeInfo.label} · <Clock size={11} /> {question.timeLimit}s
        </span>
        <button type="button"
          onPointerDown={e => e.stopPropagation()}
          onClick={e => { e.stopPropagation(); onRemove(question.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 4, display: 'flex' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Question body */}
      {!question.collapsed && (
        <div style={{ padding: '16px' }}>
          {/* Question type selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '14px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginRight: 4 }}>Type:</span>
            {QUESTION_TYPES.map(t => {
              const Icon = t.icon
              return (
                <button key={t.value} type="button" onClick={() => changeType(t.value)}
                  style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 600,
                    border: '1px solid var(--border-default)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
                    background: question.questionType === t.value ? 'var(--primary-500)' : 'transparent',
                    color: question.questionType === t.value ? '#fff' : 'var(--text-muted)' }}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>

          {/* Question text */}
          <div className="input-group" style={{ marginBottom: '14px' }}>
            <label className="input-label">
              {question.questionType === 'fill_blank' ? 'Question (use ___ for blanks)' : 'Question'}
            </label>
            <textarea className="input" rows={2}
              placeholder={question.questionType === 'fill_blank' ? 'The capital of France is ___.' : 'Type your question here…'}
              value={question.questionText}
              onChange={e => onUpdate(question.id, { questionText: e.target.value })}
              style={{ resize: 'vertical', minHeight: '60px' }} />
          </div>

          {/* Time limit */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Clock size={14} color="var(--text-muted)" />
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Time limit:</span>
            {[10, 15, 20, 30, 45, 60].map(t => (
              <button key={t} type="button" onClick={() => onUpdate(question.id, { timeLimit: t })}
                style={{ padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.78rem', fontWeight: 600,
                  border: '1px solid var(--border-default)', cursor: 'pointer',
                  background: question.timeLimit === t ? 'var(--primary-500)' : 'transparent',
                  color: question.timeLimit === t ? '#fff' : 'var(--text-muted)' }}>
                {t}s
              </button>
            ))}
          </div>

          {/* Multiple Choice options */}
          {question.questionType === 'multiple_choice' && (
            <>
              <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Answer Options</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {question.options.map((opt, idx) => (
                  <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button type="button" onClick={() => onUpdate(question.id, { correctIndex: idx })}
                      title={question.correctIndex === idx ? 'Correct answer' : 'Mark as correct'}
                      style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${question.correctIndex === idx ? 'var(--success-400)' : 'var(--border-default)'}`,
                        background: question.correctIndex === idx ? 'var(--success-400)' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                      {question.correctIndex === idx && <Check size={14} color="#fff" />}
                    </button>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', width: 20 }}>
                      {String.fromCharCode(65 + idx)}.
                    </span>
                    <input value={opt} onChange={e => updateOption(idx, e.target.value)}
                      placeholder={`Option ${String.fromCharCode(65 + idx)}`} className="input"
                      style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }} />
                    {question.options.length > 2 && (
                      <button type="button" onClick={() => removeOption(idx)}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 4, display: 'flex' }}>
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              {question.options.length < 6 && (
                <button type="button" onClick={addOption}
                  style={{ marginTop: '8px', background: 'none', border: '1px dashed var(--border-default)', borderRadius: 'var(--radius-sm)',
                    padding: '6px 14px', cursor: 'pointer', fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Plus size={13} /> Add Option
                </button>
              )}
            </>
          )}

          {/* True/False options */}
          {question.questionType === 'true_false' && (
            <>
              <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Correct Answer</label>
              <div style={{ display: 'flex', gap: '10px' }}>
                {['True', 'False'].map((label, idx) => (
                  <button key={label} type="button" onClick={() => onUpdate(question.id, { correctIndex: idx })}
                    style={{ flex: 1, padding: '12px', borderRadius: 'var(--radius-md)', fontWeight: 600, fontSize: '0.9rem',
                      border: `2px solid ${question.correctIndex === idx ? 'var(--success-400)' : 'var(--border-default)'}`,
                      background: question.correctIndex === idx ? 'rgba(34,197,94,0.1)' : 'transparent',
                      color: question.correctIndex === idx ? 'var(--success-400)' : 'var(--text-secondary)',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    {question.correctIndex === idx && <Check size={16} />}
                    {label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Short Answer */}
          {question.questionType === 'short_answer' && (
            <div className="input-group">
              <label className="input-label">Correct Answer</label>
              <input className="input" placeholder="Type the expected answer…"
                value={question.correctAnswer}
                onChange={e => onUpdate(question.id, { correctAnswer: e.target.value })}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Student answers will be compared to this (case-insensitive)
              </span>
            </div>
          )}

          {/* Fill in the Blank */}
          {question.questionType === 'fill_blank' && (
            <div className="input-group">
              <label className="input-label">Correct Answer (for the blank)</label>
              <input className="input" placeholder="Type the correct word/phrase…"
                value={question.correctAnswer}
                onChange={e => onUpdate(question.id, { correctAnswer: e.target.value })}
                style={{ padding: '8px 12px', fontSize: '0.85rem' }} />
              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: 4 }}>
                Use ___ in the question text to mark where the blank is
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Quiz Card ─────────────────────────────────────────────────────────────────
function QuizCard({ quiz, onClick, onDelete, readOnly }: { quiz: QuizLocal; onClick: () => void; onDelete: () => void; readOnly?: boolean }) {
  return (
    <div className="card" style={{ padding: '20px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
          Quiz
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {!readOnly && (
            <button type="button" onClick={e => { e.stopPropagation(); onDelete() }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 2, display: 'flex' }}
              title="Delete quiz">
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
      <h3 style={{ margin: '0 0 6px', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)' }}>{quiz.title}</h3>
      <p style={{ margin: '0 0 14px', fontSize: '0.8rem', color: 'var(--text-muted)', lineHeight: 1.4, minHeight: '2.8em' }}>
        {quiz.description || 'No description provided.'}
      </p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <HelpCircle size={12} /> {quiz.questionCount} question{quiz.questionCount !== 1 ? 's' : ''}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
          <Clock size={12} /> {new Date(quiz.createdAt).toLocaleDateString()}
        </span>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function QuizzesPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const [quizzes, setQuizzes] = useState<QuizLocal[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [creating, setCreating] = useState(false)

  // Builder state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionLocal[]>([])

  const isCreator = user?.role === 'teacher' || user?.role === 'member' || user?.role === 'admin'
  const supabase = createClient()

  // Targeting state
  interface GroupOption { id: string; name: string; memberCount: number }
  interface StudentOption { id: string; name: string; avatarUrl: string | null }
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [studentsOptions, setStudentsOptions] = useState<StudentOption[]>([])
  const [targetMode, setTargetMode] = useState<'groups' | 'students'>('groups')
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(new Set())
  const [selectedStudents, setSelectedStudents] = useState<Set<string>>(new Set())
  const [targetSearch, setTargetSearch] = useState('')
  // Student read-only viewer
  const [viewingQuiz, setViewingQuiz] = useState<{ title: string; description: string; questions: QuestionLocal[] } | null>(null)

  const sensors = useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Load quizzes ──
  const loadQuizzes = useCallback(async () => {
    if (!user?.id) return

    if (isCreator) {
      const { data } = await supabase
        .from('quizzes')
        .select('id, title, description, created_at')
        .eq('teacher_id', user.id)
        .order('created_at', { ascending: false })
      if (data) {
        const withCounts = await Promise.all(data.map(async q => {
          const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id)
          return { id: q.id, title: q.title, description: q.description || '', questionCount: count ?? 0, createdAt: q.created_at }
        }))
        setQuizzes(withCounts)
      }
    } else {
      // Student: load quizzes shared via quiz_targets
      const { data: directTargets } = await supabase
        .from('quiz_targets')
        .select('quiz_id')
        .eq('target_type', 'student')
        .eq('target_id', user.id)

      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', user.id)

      let groupQuizIds: string[] = []
      if (myGroups && myGroups.length > 0) {
        const gids = myGroups.map(g => g.group_id)
        const { data: groupTargets } = await supabase
          .from('quiz_targets')
          .select('quiz_id')
          .eq('target_type', 'group')
          .in('target_id', gids)
        if (groupTargets) groupQuizIds = groupTargets.map(t => t.quiz_id)
      }

      const directIds = directTargets?.map(t => t.quiz_id) || []
      const allIds = [...new Set([...directIds, ...groupQuizIds])]

      if (allIds.length > 0) {
        const { data } = await supabase
          .from('quizzes')
          .select('id, title, description, created_at')
          .in('id', allIds)
          .order('created_at', { ascending: false })
        if (data) {
          const withCounts = await Promise.all(data.map(async q => {
            const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id)
            return { id: q.id, title: q.title, description: q.description || '', questionCount: count ?? 0, createdAt: q.created_at }
          }))
          setQuizzes(withCounts.filter(q => q.questionCount > 0))
        }
      } else {
        setQuizzes([])
      }
    }

    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { loadQuizzes() }, [loadQuizzes])

  // ── Load groups + students for targeting (teacher only) ──
  useEffect(() => {
    if (!user?.id || !isCreator) return
    async function loadTargets() {
      const { data: grps } = await supabase.from('groups').select('id, name').eq('teacher_id', user!.id)
      if (grps) {
        const groupsWithCount: GroupOption[] = []
        for (const g of grps) {
          const { count } = await supabase.from('group_members').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
          groupsWithCount.push({ id: g.id, name: g.name, memberCount: count || 0 })
        }
        setGroups(groupsWithCount)
      }
      const { data: enrolled } = await supabase.from('teacher_students').select('student_id').eq('teacher_id', user!.id).eq('status', 'active')
      if (enrolled && enrolled.length > 0) {
        const ids = enrolled.map(e => e.student_id)
        const { data: profiles } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', ids)
        if (profiles) setStudentsOptions(profiles.map(p => ({ id: p.id, name: p.full_name || 'Student', avatarUrl: p.avatar_url })))
      }
    }
    loadTargets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isCreator])

  // ── Load targets when opening a quiz for editing ──
  useEffect(() => {
    if (!editingId || !isCreator) return
    async function loadQuizTargets() {
      const { data: targets } = await supabase.from('quiz_targets').select('*').eq('quiz_id', editingId!)
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
    loadQuizTargets()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingId])

  // ── Open builder ──
  async function openQuiz(quizId: string) {
    // Student: open read-only viewer
    if (!isCreator) {
      const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
      if (!quiz) return
      const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', quiz.id).order('sort_order')
      setViewingQuiz({
        title: quiz.title,
        description: quiz.description || '',
        questions: (qs || []).map(q => ({
          id: q.id, questionText: q.question_text, questionType: (q.question_type || 'multiple_choice') as QuestionType,
          options: Array.isArray(q.options) ? q.options as string[] : [],
          correctIndex: q.correct_index, correctAnswer: q.correct_answer || '',
          timeLimit: q.time_limit, sortOrder: q.sort_order, collapsed: false,
        })),
      })
      return
    }
    const { data: quiz } = await supabase.from('quizzes').select('*').eq('id', quizId).single()
    if (!quiz) return
    setEditingId(quiz.id)
    setTitle(quiz.title)
    setDescription(quiz.description || '')

    const { data: qs } = await supabase
      .from('quiz_questions')
      .select('*')
      .eq('quiz_id', quiz.id)
      .order('sort_order')
    setQuestions((qs || []).map(q => ({
      id: q.id,
      questionText: q.question_text,
      questionType: (q.question_type || 'multiple_choice') as QuestionType,
      options: Array.isArray(q.options) ? q.options as string[] : [],
      correctIndex: q.correct_index,
      correctAnswer: q.correct_answer || '',
      timeLimit: q.time_limit,
      sortOrder: q.sort_order,
      collapsed: true,
    })))
  }

  // ── Create new quiz ──
  async function createNew() {
    if (!user?.id || creating) return
    setCreating(true)
    try {
      const { data, error } = await supabase.from('quizzes').insert({
        teacher_id: user.id,
        title: 'Untitled Quiz',
        description: null,
        pass_threshold: 70,
      }).select('id, title, description, created_at').single()
      if (error) { console.error('Quiz create error:', error); showToast(`❌ ${error.message}`); return }
      if (!data) return
      setEditingId(data.id)
      setTitle(data.title)
      setDescription(data.description || '')
      setQuestions([{
        id: uid(),
        questionText: '',
        questionType: 'multiple_choice' as QuestionType,
        options: ['', '', '', ''],
        correctIndex: 0,
        correctAnswer: '',
        timeLimit: 30,
        sortOrder: 0,
        collapsed: false,
      }])
      showToast('✅ Quiz created')
      loadQuizzes()
    } finally {
      setCreating(false)
    }
  }

  // ── Save quiz ──
  async function saveQuiz() {
    if (!editingId || !title.trim()) return
    setSaving(true)

    await supabase.from('quizzes').update({
      title: title.trim(),
      description: description.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', editingId)

    // Sync questions: delete all then re-insert
    await supabase.from('quiz_questions').delete().eq('quiz_id', editingId)
    if (questions.length > 0) {
      const rows = questions.map((q, i) => ({
        quiz_id: editingId,
        question_text: q.questionText.trim() || 'Untitled Question',
        question_type: q.questionType,
        options: q.options,
        correct_index: q.correctIndex,
        correct_answer: q.correctAnswer.trim() || null,
        sort_order: i,
        time_limit: q.timeLimit,
      }))
      await supabase.from('quiz_questions').insert(rows)
    }

    // Save targets
    await supabase.from('quiz_targets').delete().eq('quiz_id', editingId)
    const targets: { quiz_id: string; target_type: 'group' | 'student'; target_id: string }[] = targetMode === 'groups'
      ? Array.from(selectedGroups).map(gid => ({ quiz_id: editingId, target_type: 'group' as const, target_id: gid }))
      : Array.from(selectedStudents).map(sid => ({ quiz_id: editingId, target_type: 'student' as const, target_id: sid }))
    if (targets.length > 0) await supabase.from('quiz_targets').insert(targets)

    setSaving(false)
    showToast('✅ Quiz saved')
    loadQuizzes()
  }

  // ── Delete quiz ──
  async function deleteQuiz(id: string) {
    if (!confirm('Delete this quiz? This cannot be undone.')) return
    await supabase.from('quizzes').delete().eq('id', id)
    if (editingId === id) closeBuilder()
    showToast('✅ Quiz deleted')
    loadQuizzes()
  }

  // ── Close builder ──
  function closeBuilder() {
    setEditingId(null)
    setTitle('')
    setDescription('')
    setQuestions([])
  }

  // ── Question helpers ──
  function addQuestion() {
    setQuestions(prev => [...prev, {
      id: uid(),
      questionText: '',
      questionType: 'multiple_choice' as QuestionType,
      options: ['', '', '', ''],
      correctIndex: 0,
      correctAnswer: '',
      timeLimit: 30,
      sortOrder: prev.length,
      collapsed: false,
    }])
  }

  function updateQuestion(id: string, updates: Partial<QuestionLocal>) {
    setQuestions(prev => prev.map(q => q.id === id ? { ...q, ...updates } : q))
  }

  function removeQuestion(id: string) {
    setQuestions(prev => prev.filter(q => q.id !== id))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (over && active.id !== over.id) {
      setQuestions(prev => {
        const oldIndex = prev.findIndex(q => q.id === active.id)
        const newIndex = prev.findIndex(q => q.id === over.id)
        return arrayMove(prev, oldIndex, newIndex)
      })
    }
  }

  const filteredQuizzes = quizzes.filter(q => q.title.toLowerCase().includes(search.toLowerCase()))

  // ══════════════════════════════════════════════════════════════════════════
  //  STUDENT READ-ONLY QUIZ VIEW
  // ══════════════════════════════════════════════════════════════════════════
  if (viewingQuiz) {
    const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']
    return (
      <div style={{ maxWidth: '780px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px' }}>
          <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={() => setViewingQuiz(null)}>Back</Button>
          <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>{viewingQuiz.title}</h1>
        </div>
        {viewingQuiz.description && (
          <div className="card" style={{ padding: '16px', marginBottom: '16px' }}>
            <p style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-muted)' }}>{viewingQuiz.description}</p>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {viewingQuiz.questions.map((q, qi) => {
            const qType = QUESTION_TYPES.find(t => t.value === q.questionType)
            return (
              <div key={q.id} className="card" style={{ padding: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--primary-400)' }}>Q{qi + 1}</span>
                  {qType && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', padding: '2px 8px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>{qType.label}</span>}
                  {q.timeLimit > 0 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: 'auto' }}><Clock size={12} style={{ verticalAlign: -2 }} /> {q.timeLimit}s</span>}
                </div>
                <p style={{ margin: '0 0 12px', fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-primary)' }}>{q.questionText || 'No question text'}</p>
                {q.questionType === 'multiple_choice' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {q.options.map((opt, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)' }}>
                        <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-muted)' }}>{optionLabels[i]}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>{opt || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
                {q.questionType === 'true_false' && (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <div style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-primary)' }}>True</div>
                    <div style={{ flex: 1, padding: '10px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', textAlign: 'center', fontSize: '0.85rem', color: 'var(--text-primary)' }}>False</div>
                  </div>
                )}
                {(q.questionType === 'short_answer' || q.questionType === 'fill_blank') && (
                  <div style={{ padding: '10px 12px', borderRadius: 'var(--radius-sm)', background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                    {q.questionType === 'short_answer' ? 'Short answer response' : 'Fill in the blank'}
                  </div>
                )}
              </div>
            )
          })}
          {viewingQuiz.questions.length === 0 && (
            <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: 0 }}>This quiz has no questions yet.</p>
            </div>
          )}
        </div>
        {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  BUILDER VIEW (Teachers only)
  // ══════════════════════════════════════════════════════════════════════════
  if (editingId) {
    return (
      <div style={{ maxWidth: '780px' }}>
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Button variant="ghost" size="sm" icon={<ArrowLeft size={15} />} onClick={closeBuilder}>Back</Button>
            <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quiz Builder</h1>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button variant="outline" size="sm" icon={<Trash2 size={14} />} onClick={() => deleteQuiz(editingId)}>Delete</Button>
            <Button size="sm" icon={<Save size={14} />} onClick={saveQuiz} loading={saving}>Save</Button>
          </div>
        </div>

        {/* Meta fields */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <Input label="Quiz Title" required value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Chapter 5 Review" />
            <div className="input-group">
              <label className="input-label">Description <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span></label>
              <textarea className="input" rows={2} placeholder="Brief quiz description…" value={description}
                onChange={e => setDescription(e.target.value)} style={{ resize: 'vertical', minHeight: '60px' }} />
            </div>
          </div>
        </div>

        {/* Assignment – assign to groups or students */}
        <div className="card" style={{ padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
            <Users size={16} color="var(--primary-400)" />
            <span style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Share With</span>
          </div>
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
          <Input placeholder={targetMode === 'groups' ? 'Search groups…' : 'Search students…'} value={targetSearch} onChange={e => setTargetSearch(e.target.value)} leftIcon={<Search size={14} />} />
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
              studentsOptions.filter(s => s.name.toLowerCase().includes(targetSearch.toLowerCase())).map(s => (
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
            {targetMode === 'students' && studentsOptions.length === 0 && (
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textAlign: 'center', padding: '12px' }}>No enrolled students</p>
            )}
          </div>
          {(selectedGroups.size > 0 || selectedStudents.size > 0) && (
            <div style={{ marginTop: '8px', fontSize: '0.78rem', color: 'var(--primary-400)' }}>
              {targetMode === 'groups' ? `${selectedGroups.size} group(s) selected` : `${selectedStudents.size} student(s) selected`}
            </div>
          )}
        </div>

        {/* Questions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Questions ({questions.length})
          </h2>
        </div>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={questions.map(q => q.id)} strategy={verticalListSortingStrategy}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {questions.map(q => (
                <SortableQuestion key={q.id} question={q} onUpdate={updateQuestion} onRemove={removeQuestion} />
              ))}
            </div>
          </SortableContext>
        </DndContext>

        {questions.length === 0 && (
          <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
            <HelpCircle size={32} color="var(--text-muted)" style={{ margin: '0 auto 12px' }} />
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', margin: '0 0 16px' }}>No questions yet. Add your first question!</p>
            <Button icon={<Plus size={15} />} onClick={addQuestion}>Add Question</Button>
          </div>
        )}

        {/* Add Question — always at the bottom */}
        {questions.length > 0 && (
          <div style={{ marginTop: '12px' }}>
            <Button variant="ghost" icon={<Plus size={15} />} onClick={addQuestion}>Add Question</Button>
          </div>
        )}

        {/* Toast */}
        {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
      </div>
    )
  }

  // ══════════════════════════════════════════════════════════════════════════
  //  LIST VIEW
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ maxWidth: '960px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>Quizzes</h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            {isCreator ? 'Create and manage quizzes to present during live sessions' : 'Browse available quizzes'}
          </p>
        </div>
        {isCreator && <Button icon={<Plus size={15} />} onClick={createNew} loading={creating}>New Quiz</Button>}
      </div>

      {/* Search */}
      {quizzes.length > 0 && (
        <div style={{ marginBottom: '16px' }}>
          <Input placeholder="Search quizzes…" value={search} onChange={e => setSearch(e.target.value)} leftIcon={<HelpCircle size={14} />} />
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="card" style={{ padding: '40px', textAlign: 'center' }}>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>Loading quizzes…</p>
        </div>
      ) : filteredQuizzes.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
          {filteredQuizzes.map(q => (
            <QuizCard key={q.id} quiz={q} onClick={() => openQuiz(q.id)} onDelete={() => deleteQuiz(q.id)} readOnly={!isCreator} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <HelpCircle size={28} color="#8b5cf6" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No quizzes yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
            {isCreator ? 'Create your first quiz and use it in live sessions' : 'No quizzes are available yet. Check back soon.'}
          </p>
          {isCreator && <Button icon={<Plus size={15} />} onClick={createNew} loading={creating}>Create Your First Quiz</Button>}
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
