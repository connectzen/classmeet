'use client'

import { useState, useCallback, useEffect } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import {
  HelpCircle, Plus, Trash2, ArrowLeft, Save, Clock,
  GripVertical, ChevronDown, ChevronRight, Check, X,
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

// ── Types ─────────────────────────────────────────────────────────────────────
interface QuestionLocal {
  id: string
  questionText: string
  options: string[]
  correctIndex: number
  timeLimit: number
  sortOrder: number
  collapsed: boolean
}

interface QuizLocal {
  id: string
  title: string
  description: string
  questionCount: number
  createdAt: string
}

const uid = () => `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

// ── Toast ─────────────────────────────────────────────────────────────────────
function useToast() {
  const [toast, setToast] = useState<string | null>(null)
  const show = useCallback((msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3500) }, [])
  return { toast, show }
}

// ── Sortable Question ─────────────────────────────────────────────────────────
function SortableQuestion({ question, onUpdate, onRemove }: {
  question: QuestionLocal
  onUpdate: (id: string, updates: Partial<QuestionLocal>) => void
  onRemove: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: question.id })
  const style = { transform: CSS.Transform.toString(transform), transition }

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

  return (
    <div ref={setNodeRef} style={style} className="card" key={question.id}>
      {/* Question header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '14px 16px', cursor: 'pointer',
        borderBottom: question.collapsed ? 'none' : '1px solid var(--border-subtle)' }}
        onClick={() => onUpdate(question.id, { collapsed: !question.collapsed })}>
        <span {...attributes} {...listeners} style={{ cursor: 'grab', color: 'var(--text-muted)', display: 'flex' }}
          onClick={e => e.stopPropagation()}>
          <GripVertical size={16} />
        </span>
        {question.collapsed ? <ChevronRight size={16} color="var(--text-muted)" /> : <ChevronDown size={16} color="var(--text-muted)" />}
        <span style={{ flex: 1, fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {question.questionText || 'Untitled Question'}
        </span>
        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', whiteSpace: 'nowrap' }}>
          <Clock size={11} /> {question.timeLimit}s · {question.options.length} options
        </span>
        <button type="button" onClick={e => { e.stopPropagation(); onRemove(question.id) }}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 4, display: 'flex' }}>
          <Trash2 size={14} />
        </button>
      </div>

      {/* Question body */}
      {!question.collapsed && (
        <div style={{ padding: '16px' }}>
          {/* Question text */}
          <div className="input-group" style={{ marginBottom: '14px' }}>
            <label className="input-label">Question</label>
            <textarea className="input" rows={2} placeholder="Type your question here…"
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

          {/* Options */}
          <label className="input-label" style={{ marginBottom: '8px', display: 'block' }}>Answer Options</label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {question.options.map((opt, idx) => (
              <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {/* Correct indicator */}
                <button type="button" onClick={() => onUpdate(question.id, { correctIndex: idx })}
                  title={question.correctIndex === idx ? 'Correct answer' : 'Mark as correct'}
                  style={{ width: 28, height: 28, borderRadius: '50%', border: `2px solid ${question.correctIndex === idx ? 'var(--success-400)' : 'var(--border-default)'}`,
                    background: question.correctIndex === idx ? 'var(--success-400)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}>
                  {question.correctIndex === idx && <Check size={14} color="#fff" />}
                </button>
                {/* Option label */}
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', width: 20 }}>
                  {String.fromCharCode(65 + idx)}.
                </span>
                <input
                  value={opt}
                  onChange={e => updateOption(idx, e.target.value)}
                  placeholder={`Option ${String.fromCharCode(65 + idx)}`}
                  className="input"
                  style={{ flex: 1, padding: '8px 12px', fontSize: '0.85rem' }}
                />
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
        </div>
      )}
    </div>
  )
}

// ── Quiz Card ─────────────────────────────────────────────────────────────────
function QuizCard({ quiz, onClick, onDelete }: { quiz: QuizLocal; onClick: () => void; onDelete: () => void }) {
  return (
    <div className="card" style={{ padding: '20px', cursor: 'pointer' }} onClick={onClick}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: '9999px', fontSize: '0.72rem', fontWeight: 600, background: 'rgba(139,92,246,0.12)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.2)' }}>
          Quiz
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <button type="button" onClick={e => { e.stopPropagation(); onDelete() }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--error-400)', padding: 2, display: 'flex' }}
            title="Delete quiz">
            <Trash2 size={13} />
          </button>
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

  // Builder state
  const [editingId, setEditingId] = useState<string | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [questions, setQuestions] = useState<QuestionLocal[]>([])

  const isCreator = user?.role === 'teacher' || user?.role === 'member' || user?.role === 'admin'
  const supabase = createClient()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  // ── Load quizzes ──
  const loadQuizzes = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('quizzes')
      .select('id, title, description, created_at')
      .eq('teacher_id', user.id)
      .order('created_at', { ascending: false })
    if (data) {
      // Count questions per quiz
      const withCounts = await Promise.all(data.map(async q => {
        const { count } = await supabase.from('quiz_questions').select('id', { count: 'exact', head: true }).eq('quiz_id', q.id)
        return { id: q.id, title: q.title, description: q.description || '', questionCount: count ?? 0, createdAt: q.created_at }
      }))
      setQuizzes(withCounts)
    }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  useEffect(() => { loadQuizzes() }, [loadQuizzes])

  // ── Open builder ──
  async function openQuiz(quizId: string) {
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
      options: Array.isArray(q.options) ? q.options as string[] : [],
      correctIndex: q.correct_index,
      timeLimit: q.time_limit,
      sortOrder: q.sort_order,
      collapsed: true,
    })))
  }

  // ── Create new quiz ──
  async function createNew() {
    if (!user?.id) return
    const { data, error } = await supabase.from('quizzes').insert({
      teacher_id: user.id,
      title: 'Untitled Quiz',
      description: null,
    }).select('id, title, description, created_at').single()
    if (error || !data) return
    setEditingId(data.id)
    setTitle(data.title)
    setDescription(data.description || '')
    setQuestions([])
    showToast('✅ Quiz created')
    loadQuizzes()
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
        options: q.options,
        correct_index: q.correctIndex,
        sort_order: i,
        time_limit: q.timeLimit,
      }))
      await supabase.from('quiz_questions').insert(rows)
    }

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
      options: ['', '', '', ''],
      correctIndex: 0,
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
  //  BUILDER VIEW
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

        {/* Questions */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Questions ({questions.length})
          </h2>
          <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={addQuestion}>Add Question</Button>
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
            Create and manage quizzes to present during live sessions
          </p>
        </div>
        {isCreator && <Button icon={<Plus size={15} />} onClick={createNew}>New Quiz</Button>}
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
            <QuizCard key={q.id} quiz={q} onClick={() => openQuiz(q.id)} onDelete={() => deleteQuiz(q.id)} />
          ))}
        </div>
      ) : (
        <div className="card" style={{ padding: '60px 40px', textAlign: 'center' }}>
          <div style={{ width: 64, height: 64, borderRadius: '50%', background: 'rgba(139,92,246,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
            <HelpCircle size={28} color="#8b5cf6" />
          </div>
          <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>No quizzes yet</h3>
          <p style={{ margin: '0 0 24px', fontSize: '0.875rem', color: 'var(--text-muted)', maxWidth: '320px', marginLeft: 'auto', marginRight: 'auto' }}>
            Create your first quiz and use it in live sessions
          </p>
          <Button icon={<Plus size={15} />} onClick={createNew}>Create Your First Quiz</Button>
        </div>
      )}

      {/* Toast */}
      {toast && <div className="toast toast-success" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}
