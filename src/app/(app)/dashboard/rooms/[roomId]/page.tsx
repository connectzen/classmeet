'use client'

import { useEffect, useState, useRef, useCallback, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useAppStore } from '@/store/app-store'
import { Track } from 'livekit-client'
import {
  LiveKitRoom,
  RoomAudioRenderer,
  useParticipants,
  useLocalParticipant,
  useTracks,
  useChat,
  useIsSpeaking,
  useRoomContext,
  VideoTrack,
  useDataChannel,
} from '@livekit/components-react'
import type { TrackReferenceOrPlaceholder } from '@livekit/components-core'
import type { Participant as LKParticipant } from 'livekit-client'
import {
  Mic, MicOff, Video, VideoOff, Monitor, Hand, Settings,
  LogOut, Send, Users, MessageSquare, X, ChevronLeft, ChevronRight,
  MonitorOff, Volume2, PenTool, BookOpen, HelpCircle,
  Check, Clock, ArrowLeft, ArrowRight,
} from 'lucide-react'
import Blackboard, { type BlackboardEvent, type BlackboardHandle } from '@/components/room/Blackboard'
import { createClient } from '@/lib/supabase/client'
import type { Quiz, QuizQuestion as DBQuizQuestion, Course, Topic, Lesson } from '@/lib/supabase/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
function getInitials(name: string) {
  return name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?'
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Hand-raise data channel codec ────────────────────────────────────────────
const HAND_TOPIC = 'hand-raise'
const PROMOTE_TOPIC = 'promote'
const BLACKBOARD_TOPIC = 'blackboard'
const PRESENT_TOPIC = 'present'
const encoder = new TextEncoder()
const decoder = new TextDecoder()

// ── Presentation types ───────────────────────────────────────────────────────
type LayerKey = 'blackboard' | 'course' | 'quiz'

interface LinkedCourse extends Course {
  topics: (Topic & { lessons: Lesson[] })[]
}

interface LinkedQuiz extends Quiz {
  questions: DBQuizQuestion[]
}

interface PresentEvent {
  type:
    | 'start-course'
    | 'stop-course'
    | 'start-quiz'
    | 'stop-quiz'
    | 'layer-order'
    | 'course-navigate'
    | 'course-scroll'
    | 'quiz-advance'
    | 'quiz-reveal'
    | 'quiz-answer'
  courseId?: string
  quizId?: string
  lessonIndex?: number
  questionIndex?: number
  identity?: string
  answerIndex?: number
  scrollTop?: number
  order?: LayerKey[]
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const user = useAppStore(s => s.user)
  const roomId = params.roomId as string

  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const livekitUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!
  const roomName = decodeURIComponent(roomId)

  useEffect(() => {
    if (!user) return
    const identity = user.fullName || user.email
    fetch(`/api/livekit/token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(identity)}`)
      .then(async r => {
        const data = await r.json()
        if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`)
        if (!data.token) throw new Error('No token returned from server')
        setToken(data.token)
      })
      .catch((err) => {
        console.error('Token fetch error:', err)
        setError(err.message || 'Failed to connect')
      })
  }, [user, roomName])

  // ── Loading state ──
  if (error) {
    return (
      <div className="room-fullscreen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px', color: 'var(--text-primary)' }}>Connection Error</h2>
          <p style={{ color: 'var(--text-muted)', marginBottom: 24 }}>{error}</p>
          <button className="btn btn-outline" onClick={() => router.push('/dashboard/rooms')}>← Back to Rooms</button>
        </div>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="room-fullscreen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div className="room-spinner" />
          <p style={{ color: 'var(--text-muted)', marginTop: 16 }}>
            Connecting to <strong style={{ color: 'var(--text-primary)' }}>{roomName}</strong>…
          </p>
        </div>
      </div>
    )
  }

  return (
    <LiveKitRoom
      serverUrl={livekitUrl}
      token={token}
      connect={true}
      video={true}
      audio={true}
      options={{
        dynacast: true,
        adaptiveStream: true,
      }}
      onDisconnected={() => router.push('/dashboard/rooms')}
      className="room-fullscreen"
    >
      <RoomInner roomName={roomName} />
      <RoomAudioRenderer />
    </LiveKitRoom>
  )
}

// ── Room Inner (requires LiveKitRoom context) ────────────────────────────────
function RoomInner({ roomName }: { roomName: string }) {
  const router = useRouter()
  const user = useAppStore(s => s.user)
  const participants = useParticipants()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()
  const room = useRoomContext()

  // Spotlight / promotion (synced via data channel)
  const [spotlightIdentity, setSpotlightIdentity] = useState<string | null>(null)
  // Raised hands (set of participant identities)
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set())
  const initialIsMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false
  // Panel visibility tracks desktop and mobile independently.
  const [desktopShowParticipants, setDesktopShowParticipants] = useState(!initialIsMobile)
  const [desktopShowChat, setDesktopShowChat] = useState(!initialIsMobile)
  const [mobileShowParticipants, setMobileShowParticipants] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  // Blackboard
  const [blackboardActive, setBlackboardActive] = useState(false)
  const [blackboardEvent, setBlackboardEvent] = useState<BlackboardEvent | null>(null)
  const blackboardRef = useRef<BlackboardHandle>(null)
  const prevParticipantCount = useRef(0)
  const prevPresentParticipantCount = useRef(0)
  // Presentation state
  const [linkedCourses, setLinkedCourses] = useState<LinkedCourse[]>([])
  const [linkedQuizzes, setLinkedQuizzes] = useState<LinkedQuiz[]>([])
  const [courseActive, setCourseActive] = useState(false)
  const [quizActive, setQuizActive] = useState(false)
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [activeQuizId, setActiveQuizId] = useState<string | null>(null)
  const [layerOrder, setLayerOrder] = useState<LayerKey[]>([])
  const [currentLessonIndex, setCurrentLessonIndex] = useState(0)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [quizRevealed, setQuizRevealed] = useState(false)
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({})
  const [courseScrollTop, setCourseScrollTop] = useState(0)  // Mobile detection – null means "not yet determined"
  const [isMobile, setIsMobile] = useState<boolean>(initialIsMobile)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'member'

  const showParticipants = isMobile ? mobileShowParticipants : desktopShowParticipants
  const showChat = isMobile ? mobileShowChat : desktopShowChat

  const setParticipantsVisible = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    if (isMobile) {
      setMobileShowParticipants(prev => typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
      return
    }
    setDesktopShowParticipants(prev => typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
  }, [isMobile])

  const setChatVisible = useCallback((next: boolean | ((prev: boolean) => boolean)) => {
    if (isMobile) {
      setMobileShowChat(prev => typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
      return
    }
    setDesktopShowChat(prev => typeof next === 'function' ? (next as (v: boolean) => boolean)(prev) : next)
  }, [isMobile])

  const bringLayerToFront = useCallback((layer: LayerKey) => {
    setLayerOrder(prev => [...prev.filter(item => item !== layer), layer])
  }, [])

  const removeLayerFromOrder = useCallback((layer: LayerKey) => {
    setLayerOrder(prev => prev.filter(item => item !== layer))
  }, [])

  // Load linked courses/quizzes for this session
  useEffect(() => {
    const load = async () => {
      const supabase = createClient()
      // Find session by room_name
      const { data: session } = await supabase
        .from('sessions')
        .select('id')
        .eq('room_name', roomName)
        .single()
      if (!session) return

      // Load linked courses with topics + lessons
      const { data: sessionCourses } = await supabase
        .from('session_courses')
        .select('course_id')
        .eq('session_id', session.id)
      if (sessionCourses && sessionCourses.length > 0) {
        const courseIds = sessionCourses.map(sc => sc.course_id)
        const { data: courses } = await supabase
          .from('courses')
          .select('*')
          .in('id', courseIds)
        if (courses) {
          const coursesWithContent: LinkedCourse[] = await Promise.all(
            courses.map(async (course) => {
              const { data: topics } = await supabase
                .from('topics')
                .select('*')
                .eq('course_id', course.id)
                .order('sort_order')
              const topicsWithLessons = await Promise.all(
                (topics || []).map(async (topic) => {
                  const { data: lessons } = await supabase
                    .from('lessons')
                    .select('*')
                    .eq('topic_id', topic.id)
                    .order('sort_order')
                  return { ...topic, lessons: lessons || [] }
                })
              )
              return { ...course, topics: topicsWithLessons }
            })
          )
          setLinkedCourses(coursesWithContent)
        }
      }

      // Load linked quizzes with questions
      const { data: sessionQuizzes } = await supabase
        .from('session_quizzes')
        .select('quiz_id')
        .eq('session_id', session.id)
      if (sessionQuizzes && sessionQuizzes.length > 0) {
        const quizIds = sessionQuizzes.map(sq => sq.quiz_id)
        const { data: quizzes } = await supabase
          .from('quizzes')
          .select('*')
          .in('id', quizIds)
        if (quizzes) {
          const quizzesWithQuestions: LinkedQuiz[] = await Promise.all(
            quizzes.map(async (quiz) => {
              const { data: questions } = await supabase
                .from('quiz_questions')
                .select('*')
                .eq('quiz_id', quiz.id)
                .order('sort_order')
              return { ...quiz, questions: questions || [] }
            })
          )
          setLinkedQuizzes(quizzesWithQuestions)
        }
      }
    }
    load()
  }, [roomName])

  // Hand raise data channel
  const { send: sendHandData } = useDataChannel(HAND_TOPIC, (msg) => {
    const data = JSON.parse(decoder.decode(msg.payload))
    setRaisedHands(prev => {
      const next = new Set(prev)
      if (data.raised) next.add(data.identity)
      else next.delete(data.identity)
      return next
    })
  })

  // Promote data channel — teacher broadcasts, everyone receives
  const { send: sendPromoteData } = useDataChannel(PROMOTE_TOPIC, (msg) => {
    const data = JSON.parse(decoder.decode(msg.payload))
    setSpotlightIdentity(data.identity || null)
  })

  // Blackboard data channel — host broadcasts canvas events, participants receive
  const { send: sendBlackboardData } = useDataChannel(BLACKBOARD_TOPIC, (msg) => {
    const event = JSON.parse(decoder.decode(msg.payload)) as BlackboardEvent
    if (event.type === 'activate') {
      setBlackboardActive(true)
      bringLayerToFront('blackboard')
    } else if (event.type === 'deactivate') {
      setBlackboardActive(false)
      removeLayerFromOrder('blackboard')
    } else if (
      event.type === 'drawing-live' ||
      event.type === 'drawing-live-end' ||
      event.type === 'cursor-move' ||
      event.type === 'shape-preview' ||
      event.type === 'shape-preview-end' ||
      event.type === 'text-cursor' ||
      event.type === 'object-moving'
    ) {
      // Live drawing / cursor / shape-preview: call imperatively to bypass React state batching
      if (!isTeacher) {
        blackboardRef.current?.applyLiveEvent(event)
      }
    } else {
      // Drawing events — only apply if not host (host already has the state)
      if (!isTeacher) {
        // A snapshot arriving means the blackboard IS active — ensure it's visible
        // (covers the case where the activate event was missed)
        if (event.type === 'snapshot') {
          setBlackboardActive(true)
        }
        setBlackboardEvent(event)
      }
    }
  })

  // Host: broadcast blackboard canvas events
  const handleBlackboardEvent = useCallback((event: BlackboardEvent) => {
    const payload = encoder.encode(JSON.stringify(event))
    // Use unreliable transport for ephemeral preview events to avoid head-of-line blocking.
    // text-cursor is kept reliable so the hide event (visible:false) is guaranteed to arrive;
    // otherwise a dropped packet leaves the caret permanently visible on student side.
    const ephemeral = event.type === 'shape-preview' || event.type === 'shape-preview-end' ||
                      event.type === 'drawing-live' || event.type === 'drawing-live-end' ||
                      event.type === 'cursor-move' ||
                      event.type === 'object-moving'
    sendBlackboardData(payload, { reliable: !ephemeral })
  }, [sendBlackboardData])

  // Presentation data channel — syncs course/quiz presentation state
  const { send: sendPresentData } = useDataChannel(PRESENT_TOPIC, (msg) => {
    const event = JSON.parse(decoder.decode(msg.payload)) as PresentEvent
    if (event.type === 'start-course') {
      setCourseActive(true)
      setActiveCourseId(event.courseId || null)
      setCurrentLessonIndex(event.lessonIndex ?? 0)
      bringLayerToFront('course')
    } else if (event.type === 'stop-course') {
      setCourseActive(false)
      removeLayerFromOrder('course')
    } else if (event.type === 'start-quiz') {
      setQuizActive(true)
      setActiveQuizId(event.quizId || null)
      setCurrentQuestionIndex(event.questionIndex ?? 0)
      setQuizRevealed(false)
      setQuizAnswers({})
      bringLayerToFront('quiz')
    } else if (event.type === 'stop-quiz') {
      setQuizActive(false)
      removeLayerFromOrder('quiz')
    } else if (event.type === 'layer-order' && event.order) {
      setLayerOrder(event.order)
    } else if (event.type === 'course-navigate') {
      setCurrentLessonIndex(event.lessonIndex ?? 0)
      setCourseScrollTop(0)
    } else if (event.type === 'course-scroll') {
      setCourseScrollTop(event.scrollTop ?? 0)
    } else if (event.type === 'quiz-advance') {
      setCurrentQuestionIndex(event.questionIndex ?? 0)
      setQuizRevealed(false)
      setQuizAnswers({})
    } else if (event.type === 'quiz-reveal') {
      setQuizRevealed(true)
    } else if (event.type === 'quiz-answer' && event.identity && event.answerIndex !== undefined) {
      setQuizAnswers(prev => ({ ...prev, [event.identity!]: event.answerIndex! }))
    }
  })

  const syncLayerOrder = useCallback((order: LayerKey[]) => {
    const payload = encoder.encode(JSON.stringify({ type: 'layer-order', order }))
    sendPresentData(payload, { reliable: true })
  }, [sendPresentData])

  const updateLayerOrder = useCallback((layer: LayerKey, makeActive: boolean) => {
    let nextOrder: LayerKey[] = []
    setLayerOrder(prev => {
      nextOrder = makeActive
        ? [...prev.filter(item => item !== layer), layer]
        : prev.filter(item => item !== layer)
      return nextOrder
    })
    syncLayerOrder(nextOrder)
  }, [syncLayerOrder])

  // Host: toggle blackboard on/off
  const toggleBlackboard = useCallback(() => {
    const next = !blackboardActive
    setBlackboardActive(next)
    if (next) bringLayerToFront('blackboard')
    else removeLayerFromOrder('blackboard')
    updateLayerOrder('blackboard', next)

    const event: BlackboardEvent = next ? { type: 'activate' } : { type: 'deactivate' }
    const payload = encoder.encode(JSON.stringify(event))
    sendBlackboardData(payload, { reliable: true })

    // Send snapshot after activation so late-joining is seamless
    if (next) {
      setTimeout(() => {
        const snapshot = blackboardRef.current?.getSnapshot()
        if (snapshot) {
          const snapPayload = encoder.encode(JSON.stringify({ type: 'snapshot', data: snapshot }))
          sendBlackboardData(snapPayload, { reliable: true })
        }
      }, 200)
    }
  }, [blackboardActive, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendBlackboardData])

  // Teacher: activate course layer
  const activateCourse = useCallback((courseId: string, lessonIndex = 0) => {
    setActiveCourseId(courseId)
    setCurrentLessonIndex(lessonIndex)
    setCourseActive(true)
    bringLayerToFront('course')
    updateLayerOrder('course', true)
    const payload = encoder.encode(JSON.stringify({ type: 'start-course', courseId, lessonIndex }))
    sendPresentData(payload, { reliable: true })
  }, [bringLayerToFront, updateLayerOrder, sendPresentData])

  const toggleCourse = useCallback(() => {
    if (!activeCourseId) return
    if (courseActive) {
      setCourseActive(false)
      removeLayerFromOrder('course')
      updateLayerOrder('course', false)
      const payload = encoder.encode(JSON.stringify({ type: 'stop-course' }))
      sendPresentData(payload, { reliable: true })
      return
    }
    setCourseActive(true)
    bringLayerToFront('course')
    updateLayerOrder('course', true)
    const payload = encoder.encode(JSON.stringify({
      type: 'start-course',
      courseId: activeCourseId,
      lessonIndex: currentLessonIndex,
    }))
    sendPresentData(payload, { reliable: true })
  }, [activeCourseId, courseActive, currentLessonIndex, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData])

  // Teacher: activate quiz layer
  const activateQuiz = useCallback((quizId: string) => {
    setActiveQuizId(quizId)
    setCurrentQuestionIndex(0)
    setQuizRevealed(false)
    setQuizAnswers({})
    setQuizActive(true)
    bringLayerToFront('quiz')
    updateLayerOrder('quiz', true)
    const payload = encoder.encode(JSON.stringify({ type: 'start-quiz', quizId, questionIndex: 0 }))
    sendPresentData(payload, { reliable: true })
  }, [bringLayerToFront, updateLayerOrder, sendPresentData])

  const toggleQuiz = useCallback(() => {
    if (!activeQuizId) return
    if (quizActive) {
      setQuizActive(false)
      removeLayerFromOrder('quiz')
      updateLayerOrder('quiz', false)
      const payload = encoder.encode(JSON.stringify({ type: 'stop-quiz' }))
      sendPresentData(payload, { reliable: true })
      return
    }
    setQuizActive(true)
    bringLayerToFront('quiz')
    updateLayerOrder('quiz', true)
    const payload = encoder.encode(JSON.stringify({
      type: 'start-quiz',
      quizId: activeQuizId,
      questionIndex: currentQuestionIndex,
    }))
    sendPresentData(payload, { reliable: true })
  }, [activeQuizId, quizActive, currentQuestionIndex, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData])

  // Teacher: navigate course lesson
  const navigateCourseLesson = useCallback((index: number) => {
    setCurrentLessonIndex(index)
    setCourseScrollTop(0)
    const payload = encoder.encode(JSON.stringify({ type: 'course-navigate', lessonIndex: index }))
    sendPresentData(payload, { reliable: true })
  }, [sendPresentData])

  // Teacher: sync course scroll position to students
  const scrollCourseContent = useCallback((scrollTop: number) => {
    setCourseScrollTop(scrollTop)
    const payload = encoder.encode(JSON.stringify({ type: 'course-scroll', scrollTop }))
    sendPresentData(payload, { reliable: false })
  }, [sendPresentData])

  // Teacher: advance quiz question
  const advanceQuizQuestion = useCallback((index: number) => {
    setCurrentQuestionIndex(index)
    setQuizRevealed(false)
    setQuizAnswers({})
    const payload = encoder.encode(JSON.stringify({ type: 'quiz-advance', questionIndex: index }))
    sendPresentData(payload, { reliable: true })
  }, [sendPresentData])

  // Teacher: reveal quiz answer
  const revealQuizAnswer = useCallback(() => {
    setQuizRevealed(true)
    const payload = encoder.encode(JSON.stringify({ type: 'quiz-reveal' }))
    sendPresentData(payload, { reliable: true })
  }, [sendPresentData])

  // Student: submit quiz answer
  const submitQuizAnswer = useCallback((answerIndex: number) => {
    setQuizAnswers(prev => ({ ...prev, [localParticipant.identity]: answerIndex }))
    const payload = encoder.encode(JSON.stringify({
      type: 'quiz-answer',
      identity: localParticipant.identity,
      answerIndex,
    }))
    sendPresentData(payload, { reliable: true })
  }, [localParticipant.identity, sendPresentData])

  // Get active course/quiz data
  const activeCourse = useMemo(() =>
    linkedCourses.find(c => c.id === activeCourseId) || null
  , [linkedCourses, activeCourseId])

  const activeQuiz = useMemo(() =>
    linkedQuizzes.find(q => q.id === activeQuizId) || null
  , [linkedQuizzes, activeQuizId])

  // Flatten lessons for course navigation
  const allLessons = useMemo(() => {
    if (!activeCourse) return []
    return activeCourse.topics.flatMap(t => t.lessons)
  }, [activeCourse])

  const courseContentScrollRef = useRef<HTMLDivElement | null>(null)

  // Teacher: arrow keys navigate lessons while a course is active
  useEffect(() => {
    if (!isTeacher || !courseActive || !activeCourse) return
    const isEditableTarget = (t: EventTarget | null) => {
      if (!(t instanceof HTMLElement)) return false
      if (t.isContentEditable) return true
      const tag = t.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select'
    }
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.isComposing || isEditableTarget(e.target)) return
      if (e.key === 'ArrowRight') {
        e.preventDefault()
        const next = currentLessonIndex + 1
        if (next < allLessons.length) navigateCourseLesson(next)
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        const prev = currentLessonIndex - 1
        if (prev >= 0) navigateCourseLesson(prev)
      } else if (e.key === 'ArrowDown') {
        e.preventDefault()
        if (courseContentScrollRef.current) courseContentScrollRef.current.scrollTop += 150
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        if (courseContentScrollRef.current) courseContentScrollRef.current.scrollTop -= 150
      }
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [isTeacher, courseActive, activeCourse, currentLessonIndex, allLessons.length, navigateCourseLesson])

  // Host: send snapshot to late-joining participants
  useEffect(() => {
    if (!isTeacher || !blackboardActive) {
      prevParticipantCount.current = participants.length
      return
    }
    if (participants.length > prevParticipantCount.current) {
      // New participant joined — send activate + snapshot so they see the blackboard
      setTimeout(() => {
        // Send activate first so the student's blackboardActive becomes true
        const activatePayload = encoder.encode(JSON.stringify({ type: 'activate' }))
        sendBlackboardData(activatePayload, { reliable: true })
        const snapshot = blackboardRef.current?.getSnapshot()
        if (snapshot) {
          const payload = encoder.encode(JSON.stringify({ type: 'snapshot', data: snapshot }))
          sendBlackboardData(payload, { reliable: true })
        }
      }, 500)
    }
    prevParticipantCount.current = participants.length
  }, [participants.length, isTeacher, blackboardActive, sendBlackboardData])

  // Host: re-broadcast presentation state to late-joining participants
  useEffect(() => {
    if (!isTeacher || (!courseActive && !quizActive && !blackboardActive)) {
      prevPresentParticipantCount.current = participants.length
      return
    }
    if (participants.length > prevPresentParticipantCount.current) {
      setTimeout(() => {
        if (courseActive && activeCourseId) {
          const payload = encoder.encode(JSON.stringify({ type: 'start-course', courseId: activeCourseId, lessonIndex: currentLessonIndex }))
          sendPresentData(payload, { reliable: true })
          // Also send current lesson index and scroll position
          const navPayload = encoder.encode(JSON.stringify({ type: 'course-navigate', lessonIndex: currentLessonIndex }))
          sendPresentData(navPayload, { reliable: true })
          if (courseScrollTop > 0) {
            const scrollPayload = encoder.encode(JSON.stringify({ type: 'course-scroll', scrollTop: courseScrollTop }))
            sendPresentData(scrollPayload, { reliable: true })
          }
        }
        if (quizActive && activeQuizId) {
          const payload = encoder.encode(JSON.stringify({ type: 'start-quiz', quizId: activeQuizId, questionIndex: currentQuestionIndex }))
          sendPresentData(payload, { reliable: true })
          if (currentQuestionIndex > 0) {
            const navPayload = encoder.encode(JSON.stringify({ type: 'quiz-advance', questionIndex: currentQuestionIndex }))
            sendPresentData(navPayload, { reliable: true })
          }
          if (quizRevealed) {
            const revealPayload = encoder.encode(JSON.stringify({ type: 'quiz-reveal' }))
            sendPresentData(revealPayload, { reliable: true })
          }
        }
        if (blackboardActive) {
          const activatePayload = encoder.encode(JSON.stringify({ type: 'activate' }))
          sendBlackboardData(activatePayload, { reliable: true })
        }
        const orderPayload = encoder.encode(JSON.stringify({ type: 'layer-order', order: layerOrder }))
        sendPresentData(orderPayload, { reliable: true })
      }, 500)
    }
    prevPresentParticipantCount.current = participants.length
  }, [
    participants.length,
    isTeacher,
    courseActive,
    quizActive,
    blackboardActive,
    activeCourseId,
    activeQuizId,
    currentLessonIndex,
    currentQuestionIndex,
    courseScrollTop,
    quizRevealed,
    layerOrder,
    sendPresentData,
    sendBlackboardData,
  ])

  // Local hand raise
  const [myHandRaised, setMyHandRaised] = useState(false)
  const toggleHand = useCallback(() => {
    const newState = !myHandRaised
    setMyHandRaised(newState)
    const payload = encoder.encode(JSON.stringify({ identity: localParticipant.identity, raised: newState }))
    sendHandData(payload, { reliable: true })
  }, [myHandRaised, localParticipant.identity, sendHandData])

  const lowerAllHands = useCallback(() => {
    setRaisedHands(new Set())
  }, [])

  // Find the teacher participant (first non-student, or the host)
  const teacherParticipant = useMemo(() => {
    // If local user is teacher, they are the teacher
    if (isTeacher) return localParticipant
    // Otherwise, find first remote participant (usually the teacher/host)
    const remote = participants.find(p => !p.isLocal)
    return remote || participants[0]
  }, [isTeacher, localParticipant, participants])

  // Determine who's on the main stage
  const spotlightParticipant = useMemo(() => {
    // If someone is promoted via data channel, show them
    if (spotlightIdentity) {
      return participants.find(p => p.identity === spotlightIdentity) || teacherParticipant
    }
    // Default: teacher is always on main stage
    return teacherParticipant
  }, [spotlightIdentity, participants, teacherParticipant])

  // Camera tracks
  const cameraTracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
  ) as TrackReferenceOrPlaceholder[]

  // Screen share tracks
  const screenTracks = useTracks([Track.Source.ScreenShare])

  // Active screen share (takes over main stage)
  const activeScreenShare = screenTracks.length > 0 ? screenTracks[0] : null

  // Promote / demote participant — broadcasts to all participants
  const handlePromote = useCallback((identity: string) => {
    if (!isTeacher) return
    const newIdentity = spotlightIdentity === identity ? null : identity
    setSpotlightIdentity(newIdentity)
    const payload = encoder.encode(JSON.stringify({ identity: newIdentity }))
    sendPromoteData(payload, { reliable: true })
  }, [isTeacher, spotlightIdentity, sendPromoteData])

  // Leave room
  const handleLeave = useCallback(async () => {
    await room.disconnect()
    router.push('/dashboard/rooms')
  }, [room, router])

  return (
    <div className="room-layout">
      {/* Mobile: Horizontal participant strip at top */}
      {isMobile && (
        <div className="room-mobile-participants">
          {participants.map(p => {
            const camTrack = cameraTracks.find(t => t.participant?.identity === p.identity)
            const isSpotlight = spotlightIdentity === p.identity || (!spotlightIdentity && p.identity === teacherParticipant?.identity)
            return (
              <div
                key={p.identity}
                className={`room-mobile-participant ${isSpotlight ? 'room-mobile-participant-active' : ''}`}
                onClick={isTeacher ? () => handlePromote(p.identity) : undefined}
              >
                <div className="room-mobile-participant-thumb">
                  {camTrack && camTrack.publication?.track ? (
                    <VideoTrack trackRef={camTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div className="room-participant-avatar">
                      {getInitials(p.name || p.identity)}
                    </div>
                  )}
                </div>
                <span className="room-mobile-participant-name">
                  {p.isLocal ? 'You' : (p.name || p.identity).split(' ')[0]}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {/* Desktop: Left sidebar - Participants */}
      {!isMobile && showParticipants && (
        <ParticipantsPanel
          participants={participants}
          cameraTracks={cameraTracks}
          spotlightIdentity={spotlightIdentity}
          teacherIdentity={teacherParticipant?.identity || null}
          raisedHands={raisedHands}
          isTeacher={isTeacher}
          onPromote={handlePromote}
          onClose={() => setParticipantsVisible(false)}
        />
      )}

      {/* Center - Main Stage */}
      <div className="room-center">
        {/* Top bar */}
        <div className="room-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && !showParticipants && (
              <button className="room-icon-btn" onClick={() => setParticipantsVisible(true)} title="Show participants">
                <Users size={18} />
              </button>
            )}
            <div className="room-live-dot" />
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{roomName}</span>
            <span className="room-live-badge">LIVE</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <button className="room-icon-btn" onClick={() => setParticipantsVisible(v => !v)} title="Participants">
                <Users size={18} />
              </button>
            )}
            <button className="room-icon-btn" onClick={() => setChatVisible(v => !v)} title={showChat ? 'Hide chat' : 'Show chat'}>
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {/* Main stage video / blackboard / course / quiz */}
        <MainStage
          participant={spotlightParticipant}
          screenShare={activeScreenShare}
          cameraTracks={cameraTracks}
          blackboardActive={blackboardActive}
          courseActive={courseActive}
          quizActive={quizActive}
          layerOrder={layerOrder}
          isHost={isTeacher}
          onCanvasEvent={handleBlackboardEvent}
          incomingEvent={blackboardEvent}
          blackboardRef={blackboardRef}
          activeCourse={activeCourse}
          activeQuiz={activeQuiz}
          allLessons={allLessons}
          currentLessonIndex={currentLessonIndex}
          currentQuestionIndex={currentQuestionIndex}
          quizRevealed={quizRevealed}
          quizAnswers={quizAnswers}
          onNavigateLesson={navigateCourseLesson}
          onScrollCourse={scrollCourseContent}
          courseScrollTop={courseScrollTop}
          courseScrollRef={courseContentScrollRef}
          onAdvanceQuestion={advanceQuizQuestion}
          onRevealAnswer={revealQuizAnswer}
          onSubmitAnswer={submitQuizAnswer}
          localIdentity={localParticipant.identity}
        />

        {/* Bottom control bar */}
        <ControlBarCustom
          isMicEnabled={isMicrophoneEnabled}
          isCamEnabled={isCameraEnabled}
          isScreenShareEnabled={isScreenShareEnabled}
          isHandRaised={myHandRaised}
          isTeacher={isTeacher}
          localParticipant={localParticipant}
          onToggleHand={toggleHand}
          onLowerAllHands={lowerAllHands}
          onSettings={() => setShowSettings(true)}
          onLeave={handleLeave}
          raisedHandCount={raisedHands.size}
          isMobile={isMobile}
          isBlackboardActive={blackboardActive}
          onToggleBlackboard={toggleBlackboard}
          isCourseActive={courseActive}
          isQuizActive={quizActive}
          activeCourseId={activeCourseId}
          activeQuizId={activeQuizId}
          linkedCourses={linkedCourses}
          linkedQuizzes={linkedQuizzes}
          onToggleCourse={toggleCourse}
          onToggleQuiz={toggleQuiz}
          onSelectCourse={activateCourse}
          onSelectQuiz={activateQuiz}
        />
      </div>

      {/* Chat panel — overlay on mobile, sidebar on desktop */}
      {showChat && (
        <ChatPanel onClose={() => setChatVisible(false)} isMobile={isMobile} />
      )}

      {/* Mobile: participants overlay panel */}
      {isMobile && showParticipants && (
        <div className="room-mobile-overlay" onClick={() => setParticipantsVisible(false)}>
          <div className="room-mobile-panel" onClick={e => e.stopPropagation()}>
            <ParticipantsPanel
              participants={participants}
              cameraTracks={cameraTracks}
              spotlightIdentity={spotlightIdentity}
              teacherIdentity={teacherParticipant?.identity || null}
              raisedHands={raisedHands}
              isTeacher={isTeacher}
              onPromote={handlePromote}
              onClose={() => setParticipantsVisible(false)}
            />
          </div>
        </div>
      )}

      {/* Settings modal */}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
    </div>
  )
}

// ── Participants Panel ───────────────────────────────────────────────────────
interface ParticipantsPanelProps {
  participants: LKParticipant[]
  cameraTracks: TrackReferenceOrPlaceholder[]
  spotlightIdentity: string | null
  teacherIdentity: string | null
  raisedHands: Set<string>
  isTeacher: boolean
  onPromote: (identity: string) => void
  onClose: () => void
}

function ParticipantsPanel({ participants, cameraTracks, spotlightIdentity, teacherIdentity, raisedHands, isTeacher, onPromote, onClose }: ParticipantsPanelProps) {
  return (
    <div className="room-sidebar room-sidebar-left">
      <div className="room-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Participants</span>
          <span className="room-count-badge">{participants.length}</span>
        </div>
        <button className="room-icon-btn room-icon-btn-sm" onClick={onClose} title="Hide participants">
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="room-sidebar-body">
        {participants.map(p => {
          const camTrack = cameraTracks.find(t => t.participant?.identity === p.identity)
          const isSpotlight = spotlightIdentity === p.identity
          const handUp = raisedHands.has(p.identity)
          return (
            <ParticipantCard
              key={p.identity}
              participant={p}
              camTrack={camTrack}
              isSpotlight={isSpotlight}
              isHandRaised={handUp}
              isTeacher={isTeacher}
              isHost={p.identity === teacherIdentity}
              onPromote={() => onPromote(p.identity)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Participant Card ─────────────────────────────────────────────────────────
function ParticipantCard({ participant, camTrack, isSpotlight, isHandRaised, isTeacher, isHost, onPromote }: {
  participant: LKParticipant
  camTrack?: TrackReferenceOrPlaceholder
  isSpotlight: boolean
  isHandRaised: boolean
  isTeacher: boolean
  isHost: boolean
  onPromote: () => void
}) {
  const isSpeaking = useIsSpeaking(participant)
  const isMuted = !participant.isMicrophoneEnabled

  return (
    <div
      className={`room-participant-card ${isSpotlight ? 'room-participant-spotlight' : ''} ${isSpeaking ? 'room-participant-speaking' : ''}`}
      onClick={isTeacher ? onPromote : undefined}
      style={{ cursor: isTeacher ? 'pointer' : 'default' }}
      title={isTeacher ? (isSpotlight ? 'Remove from stage' : 'Promote to stage') : participant.name || participant.identity}
    >
      {/* Thumbnail */}
      <div className="room-participant-thumb">
        {camTrack && camTrack.publication?.track ? (
          <VideoTrack trackRef={camTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div className="room-participant-avatar">
            {getInitials(participant.name || participant.identity)}
          </div>
        )}
      </div>

      {/* Info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="room-participant-name">
          {participant.name || participant.identity}
          {participant.isLocal && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem' }}> (You)</span>}
        </div>
        <div style={{ fontSize: '0.7rem', color: isHost ? 'var(--primary-400)' : 'var(--text-muted)' }}>
          {participant.isLocal ? 'You' : isHost ? 'Teacher' : 'Student'}
        </div>
      </div>

      {/* Status icons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        {isHandRaised && (
          <span className="room-hand-icon" title="Hand raised">✋</span>
        )}
        {isMuted ? (
          <MicOff size={14} color="var(--error-400)" />
        ) : (
          <Mic size={14} color="var(--success-400)" />
        )}
      </div>
    </div>
  )
}

// ── Main Stage ───────────────────────────────────────────────────────────────
function MainStage({ participant, screenShare, cameraTracks, blackboardActive, courseActive, quizActive, layerOrder, isHost, onCanvasEvent, incomingEvent, blackboardRef,
  activeCourse, activeQuiz, allLessons, currentLessonIndex, currentQuestionIndex,
  quizRevealed, quizAnswers, onNavigateLesson, onScrollCourse, courseScrollTop, courseScrollRef,
  onAdvanceQuestion, onRevealAnswer, onSubmitAnswer, localIdentity,
}: {
  participant: LKParticipant | undefined
  screenShare: TrackReferenceOrPlaceholder | null
  cameraTracks: TrackReferenceOrPlaceholder[]
  blackboardActive: boolean
  courseActive: boolean
  quizActive: boolean
  layerOrder: LayerKey[]
  isHost: boolean
  onCanvasEvent: (event: BlackboardEvent) => void
  incomingEvent: BlackboardEvent | null
  blackboardRef: React.RefObject<BlackboardHandle | null>
  activeCourse: LinkedCourse | null
  activeQuiz: LinkedQuiz | null
  allLessons: Lesson[]
  currentLessonIndex: number
  currentQuestionIndex: number
  quizRevealed: boolean
  quizAnswers: Record<string, number>
  onNavigateLesson: (index: number) => void
  onScrollCourse: (scrollTop: number) => void
  courseScrollTop: number
  courseScrollRef: React.MutableRefObject<HTMLDivElement | null>
  onAdvanceQuestion: (index: number) => void
  onRevealAnswer: () => void
  onSubmitAnswer: (index: number) => void
  localIdentity: string
}) {
  const speakerParticipant = participant
  const isSpeaking = useIsSpeaking(speakerParticipant)

  const showCoursePresentation = courseActive && activeCourse
  const showQuizPresentation = quizActive && activeQuiz
  const showScreenShare = !!(screenShare && screenShare.publication?.track)
  const showCamera = !showScreenShare
  const camTrack = cameraTracks.find(t => t.participant?.identity === participant?.identity)
  const frontLayer = layerOrder[layerOrder.length - 1] || null
  const getLayerZIndex = (layer: LayerKey) => {
    const idx = layerOrder.indexOf(layer)
    return idx === -1 ? 10 : 20 + idx
  }

  return (
    <div className="room-main-stage">
      {/* Base media layer */}
      {showScreenShare && screenShare && (
        <div className="room-stage-video room-stage-screenshare" style={{ zIndex: 1 }}>
          <VideoTrack trackRef={screenShare as TrackReferenceOrPlaceholder & { publication: { track: object } }} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          <div className="room-stage-overlay">
            <div className="room-stage-label">
              <Monitor size={14} />
              <span>{screenShare.participant?.name || screenShare.participant?.identity} is sharing screen</span>
            </div>
          </div>
        </div>
      )}

      {showCamera && (
        <div className={`room-stage-video ${isSpeaking ? 'room-stage-speaking' : ''}`} style={{ zIndex: 1 }}>
          {camTrack && camTrack.publication?.track ? (
            <VideoTrack trackRef={camTrack} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <div className="room-stage-placeholder">
              <div className="room-stage-avatar">
                {getInitials(participant?.name || participant?.identity || '?')}
              </div>
              <p style={{ color: 'var(--text-muted)', marginTop: 16, fontSize: '0.9rem' }}>Camera is off</p>
            </div>
          )}
          {participant && (
            <div className="room-stage-overlay">
              <div className="room-stage-label">
                {isSpeaking && <Volume2 size={14} className="room-speaking-icon" />}
                <span>{participant.name || participant.identity}</span>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Blackboard — always mounted for persistence, hidden when inactive */}
      <div
        className={`room-stage-video room-stage-blackboard room-stage-layer ${blackboardActive ? '' : 'room-stage-hidden'} ${frontLayer === 'blackboard' ? 'room-stage-layer-front' : 'room-stage-layer-back'}`}
        style={{ zIndex: getLayerZIndex('blackboard') }}
      >
        <Blackboard
          ref={blackboardRef}
          isHost={isHost}
          onCanvasEvent={onCanvasEvent}
          incomingEvent={incomingEvent}
        />
        <div className="room-stage-overlay">
          <div className="room-stage-label">
            <PenTool size={14} />
            <span>Blackboard{isHost ? '' : ` — ${participant?.name || 'Teacher'} is presenting`}</span>
          </div>
        </div>
      </div>

      {/* Course presentation */}
      {showCoursePresentation && activeCourse && (
        <div
          className={`room-stage-video room-stage-presentation room-stage-layer ${frontLayer === 'course' ? 'room-stage-layer-front' : 'room-stage-layer-back'}`}
          style={{ zIndex: getLayerZIndex('course') }}
        >
          <CoursePresentation
            course={activeCourse}
            lessons={allLessons}
            currentIndex={currentLessonIndex}
            isHost={isHost}
            onNavigate={onNavigateLesson}
            onScroll={onScrollCourse}
            scrollTop={courseScrollTop}
            scrollRef={courseScrollRef}
            teacherName={participant?.name || 'Teacher'}
          />
        </div>
      )}

      {/* Quiz presentation */}
      {showQuizPresentation && activeQuiz && (
        <div
          className={`room-stage-video room-stage-presentation room-stage-layer ${frontLayer === 'quiz' ? 'room-stage-layer-front' : 'room-stage-layer-back'}`}
          style={{ zIndex: getLayerZIndex('quiz') }}
        >
          <QuizPresentation
            quiz={activeQuiz}
            currentIndex={currentQuestionIndex}
            revealed={quizRevealed}
            answers={quizAnswers}
            isHost={isHost}
            onAdvance={onAdvanceQuestion}
            onReveal={onRevealAnswer}
            onAnswer={onSubmitAnswer}
            localIdentity={localIdentity}
            teacherName={participant?.name || 'Teacher'}
          />
        </div>
      )}

    </div>
  )
}

// ── Course Presentation ──────────────────────────────────────────────────────
function CoursePresentation({ course, lessons, currentIndex, isHost, onNavigate, onScroll, scrollTop, scrollRef, teacherName }: {
  course: LinkedCourse
  lessons: Lesson[]
  currentIndex: number
  isHost: boolean
  onNavigate: (index: number) => void
  onScroll: (scrollTop: number) => void
  scrollTop: number
  scrollRef?: React.MutableRefObject<HTMLDivElement | null>
  teacherName: string
}) {
  const lesson = lessons[currentIndex]
  const totalLessons = lessons.length
  const contentRef = useRef<HTMLDivElement>(null)
  const scrollThrottleRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Find which topic this lesson belongs to
  const currentTopic = course.topics.find(t => t.lessons.some(l => l.id === lesson?.id))

  // Teacher: broadcast scroll position on scroll (throttled, sends ratio 0-1)
  const handleScroll = useCallback(() => {
    if (!isHost || !contentRef.current) return
    const el = contentRef.current
    const maxScroll = el.scrollHeight - el.clientHeight
    const ratio = maxScroll > 0 ? el.scrollTop / maxScroll : 0
    if (scrollThrottleRef.current) clearTimeout(scrollThrottleRef.current)
    scrollThrottleRef.current = setTimeout(() => {
      onScroll(ratio)
    }, 150)
  }, [isHost, onScroll])

  // Student: sync scroll position from teacher ratio using rAF
  useEffect(() => {
    if (isHost || !contentRef.current) return
    requestAnimationFrame(() => {
      if (contentRef.current) {
        const maxScroll = contentRef.current.scrollHeight - contentRef.current.clientHeight
        contentRef.current.scrollTop = scrollTop * maxScroll
      }
    })
  }, [isHost, scrollTop])

  return (
    <div className="room-presentation">
      <div className="room-presentation-header">
        <BookOpen size={16} />
        <span className="room-presentation-title">{course.title}</span>
        {!isHost && <span className="room-presentation-subtitle">{teacherName} is presenting</span>}
      </div>

      <div
        ref={(el) => {
          contentRef.current = el
          if (scrollRef) scrollRef.current = el
        }}
        className="room-presentation-content"
        onScroll={isHost ? handleScroll : undefined}
        style={!isHost ? { overflow: 'hidden' } : undefined}
      >
        {lesson ? (
          <>
            {currentTopic && (
              <div className="room-presentation-topic">{currentTopic.title}</div>
            )}
            <h2 className="room-presentation-lesson-title">{lesson.title}</h2>
            {lesson.type === 'video' && lesson.video_url && (
              <div className="room-presentation-video">
                <video src={lesson.video_url} controls style={{ maxWidth: '100%', maxHeight: '60vh' }} />
              </div>
            )}
            {lesson.content && (
              <div className="room-presentation-text" dangerouslySetInnerHTML={{ __html: lesson.content }} />
            )}
          </>
        ) : (
          <div className="room-presentation-empty">No lessons available</div>
        )}
      </div>

      <div className="room-presentation-nav">
        {isHost ? (
          <>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentIndex === 0}
              onClick={() => onNavigate(currentIndex - 1)}
            >
              <ArrowLeft size={16} /> Previous
            </button>
            <span className="room-presentation-counter">
              {currentIndex + 1} / {totalLessons}
            </span>
            <button
              className="btn btn-outline btn-sm"
              disabled={currentIndex >= totalLessons - 1}
              onClick={() => onNavigate(currentIndex + 1)}
            >
              Next <ArrowRight size={16} />
            </button>
          </>
        ) : (
          <span className="room-presentation-counter">
            Lesson {currentIndex + 1} of {totalLessons}
          </span>
        )}
      </div>
    </div>
  )
}

// ── Quiz Presentation ────────────────────────────────────────────────────────
function QuizPresentation({ quiz, currentIndex, revealed, answers, isHost, onAdvance, onReveal, onAnswer, localIdentity, teacherName }: {
  quiz: LinkedQuiz
  currentIndex: number
  revealed: boolean
  answers: Record<string, number>
  isHost: boolean
  onAdvance: (index: number) => void
  onReveal: () => void
  onAnswer: (index: number) => void
  localIdentity: string
  teacherName: string
}) {
  const totalQuestions = quiz.questions.length

  // Students navigate independently; teacher uses the shared currentIndex
  const [studentIndex, setStudentIndex] = useState(0)
  // Students track their own answers locally per question index
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number>>({})

  const activeIndex = isHost ? currentIndex : studentIndex
  const question = quiz.questions[activeIndex]

  // For teacher: aggregate answer stats from data channel
  const myAnswer = isHost ? answers[localIdentity] : studentAnswers[activeIndex]
  const hasAnswered = myAnswer !== undefined

  // Tally answers for each option (teacher view only)
  const answerCounts = useMemo(() => {
    const counts: Record<number, number> = {}
    Object.values(answers).forEach(a => {
      counts[a] = (counts[a] || 0) + 1
    })
    return counts
  }, [answers])

  const totalAnswers = Object.keys(answers).length

  // Student: answer the current question and broadcast it
  const handleStudentAnswer = useCallback((optionIndex: number) => {
    setStudentAnswers(prev => ({ ...prev, [activeIndex]: optionIndex }))
    onAnswer(optionIndex)
  }, [activeIndex, onAnswer])

  if (!question) {
    return (
      <div className="room-presentation">
        <div className="room-presentation-header">
          <HelpCircle size={16} />
          <span className="room-presentation-title">{quiz.title}</span>
        </div>
        <div className="room-presentation-empty">No questions available</div>
      </div>
    )
  }

  const optionLabels = ['A', 'B', 'C', 'D', 'E', 'F']

  return (
    <div className="room-presentation">
      <div className="room-presentation-header">
        <HelpCircle size={16} />
        <span className="room-presentation-title">{quiz.title}</span>
        {!isHost && <span className="room-presentation-subtitle">{teacherName} is presenting</span>}
        <span className="room-presentation-counter" style={{ marginLeft: 'auto' }}>
          Q{activeIndex + 1}/{totalQuestions}
        </span>
      </div>

      <div className="room-presentation-content room-quiz-content">
        <div className="room-quiz-question">
          <span className="room-quiz-question-number">Question {activeIndex + 1}</span>
          <h2 className="room-quiz-question-text">{question.question_text}</h2>
          {question.time_limit > 0 && (
            <div className="room-quiz-timer">
              <Clock size={14} /> {question.time_limit}s
            </div>
          )}
        </div>

        <div className="room-quiz-options">
          {question.options.map((opt, i) => {
            const isCorrect = i === question.correct_index
            const isMyAnswer = myAnswer === i
            const count = answerCounts[i] || 0
            const pct = totalAnswers > 0 ? Math.round((count / totalAnswers) * 100) : 0

            // Teacher: show reveal state; Student: show selected + immediate feedback after answering
            let optClass = 'room-quiz-option'
            if (isHost) {
              if (revealed && isCorrect) optClass += ' room-quiz-option-correct'
              if (revealed && isMyAnswer && !isCorrect) optClass += ' room-quiz-option-wrong'
              if (!revealed && isMyAnswer) optClass += ' room-quiz-option-selected'
            } else {
              if (hasAnswered && isCorrect) optClass += ' room-quiz-option-correct'
              if (hasAnswered && isMyAnswer && !isCorrect) optClass += ' room-quiz-option-wrong'
              if (!hasAnswered && isMyAnswer) optClass += ' room-quiz-option-selected'
            }

            return (
              <button
                key={i}
                className={optClass}
                onClick={() => {
                  if (!isHost && !hasAnswered) handleStudentAnswer(i)
                }}
                disabled={isHost || hasAnswered}
              >
                <span className="room-quiz-option-label">{optionLabels[i]}</span>
                <span className="room-quiz-option-text">{opt}</span>
                {((isHost && revealed) || (!isHost && hasAnswered)) && (
                  <span className="room-quiz-option-stats">
                    {isCorrect && <Check size={14} />}
                    {isHost && <span>{count} ({pct}%)</span>}
                  </span>
                )}
              </button>
            )
          })}
        </div>

        {!isHost && hasAnswered && (
          <div className="room-quiz-waiting">
            <span>{myAnswer === question.correct_index ? '✓ Correct!' : '✗ Incorrect'}</span>
          </div>
        )}
      </div>

      {/* Teacher navigation + reveal controls */}
      {isHost && (
        <div className="room-presentation-nav">
          <button
            className="btn btn-outline btn-sm"
            disabled={currentIndex === 0}
            onClick={() => onAdvance(currentIndex - 1)}
          >
            <ArrowLeft size={16} /> Prev
          </button>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {!revealed && (
              <button className="btn btn-primary btn-sm" onClick={onReveal}>
                Reveal Answer
              </button>
            )}
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {totalAnswers} answer{totalAnswers !== 1 ? 's' : ''}
            </span>
          </div>
          <button
            className="btn btn-outline btn-sm"
            disabled={currentIndex >= totalQuestions - 1}
            onClick={() => onAdvance(currentIndex + 1)}
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      )}

      {/* Student self-paced navigation */}
      {!isHost && (
        <div className="room-presentation-nav">
          <button
            className="btn btn-outline btn-sm"
            disabled={studentIndex === 0}
            onClick={() => setStudentIndex(prev => prev - 1)}
          >
            <ArrowLeft size={16} /> Previous
          </button>
          <span className="room-presentation-counter">
            {Object.keys(studentAnswers).length} of {totalQuestions} answered
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={studentIndex >= totalQuestions - 1}
            onClick={() => setStudentIndex(prev => prev + 1)}
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      )}
    </div>
  )
}

// ── Chat Panel ───────────────────────────────────────────────────────────────
function ChatPanel({ onClose, isMobile }: { onClose: () => void; isMobile?: boolean }) {
  const { chatMessages, send, isSending } = useChat()
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages.length])

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return
    await send(message.trim())
    setMessage('')
  }, [message, isSending, send])

  return (
    <div className={`room-sidebar room-sidebar-right ${isMobile ? 'room-sidebar-mobile' : ''}`}>
      {isMobile && <div className="room-mobile-overlay-bg" onClick={onClose} />}
      <div className="room-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <MessageSquare size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Chat</span>
        </div>
        <button className="room-icon-btn room-icon-btn-sm" onClick={onClose} title="Hide chat">
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="room-sidebar-body room-chat-messages" ref={scrollRef}>
        {chatMessages.length === 0 ? (
          <div style={{ padding: '40px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
            No messages yet. Say hello! 👋
          </div>
        ) : (
          chatMessages.map((msg, i) => (
            <div key={`${msg.timestamp}-${i}`} className="room-chat-msg">
              <div className="room-chat-msg-header">
                <span className="room-chat-sender">{msg.from?.name || msg.from?.identity || 'Unknown'}</span>
                <span className="room-chat-time">{formatTime(msg.timestamp)}</span>
              </div>
              <div className="room-chat-text">{msg.message}</div>
            </div>
          ))
        )}
      </div>

      <div className="room-chat-input">
        <input
          type="text"
          className="input"
          placeholder="Type a message…"
          value={message}
          onChange={e => setMessage(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleSend()}
          style={{ fontSize: '0.85rem' }}
        />
        <button
          className="room-icon-btn room-send-btn"
          onClick={handleSend}
          disabled={!message.trim() || isSending}
          title="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Control Bar ──────────────────────────────────────────────────────────────
interface ControlBarProps {
  isMicEnabled: boolean
  isCamEnabled: boolean
  isScreenShareEnabled: boolean
  isHandRaised: boolean
  isTeacher: boolean
  localParticipant: ReturnType<typeof useLocalParticipant>['localParticipant']
  onToggleHand: () => void
  onLowerAllHands: () => void
  onSettings: () => void
  onLeave: () => void
  raisedHandCount: number
  isMobile?: boolean
  isBlackboardActive: boolean
  isCourseActive: boolean
  isQuizActive: boolean
  activeCourseId: string | null
  activeQuizId: string | null
  onToggleBlackboard: () => void
  linkedCourses: LinkedCourse[]
  linkedQuizzes: LinkedQuiz[]
  onToggleCourse: () => void
  onToggleQuiz: () => void
  onSelectCourse: (courseId: string, lessonIndex: number) => void
  onSelectQuiz: (quizId: string) => void
}

function ControlBarCustom({
  isMicEnabled, isCamEnabled, isScreenShareEnabled, isHandRaised,
  isTeacher, localParticipant, onToggleHand, onLowerAllHands, onSettings, onLeave, raisedHandCount, isMobile,
  isBlackboardActive, isCourseActive, isQuizActive, activeCourseId, activeQuizId,
  onToggleBlackboard, linkedCourses, linkedQuizzes,
  onToggleCourse, onToggleQuiz, onSelectCourse, onSelectQuiz,
}: ControlBarProps) {
  const [showCourseMenu, setShowCourseMenu] = useState(false)
  const [showQuizMenu, setShowQuizMenu] = useState(false)
  const courseMenuRef = useRef<HTMLDivElement>(null)
  const quizMenuRef = useRef<HTMLDivElement>(null)

  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicEnabled)
  }, [localParticipant, isMicEnabled])

  const toggleCam = useCallback(() => {
    localParticipant.setCameraEnabled(!isCamEnabled)
  }, [localParticipant, isCamEnabled])

  const toggleScreen = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
  }, [localParticipant, isScreenShareEnabled])

  const handleCourseButton = useCallback(() => {
    if (isCourseActive || activeCourseId) {
      onToggleCourse()
      setShowCourseMenu(false)
      return
    }
    setShowCourseMenu(v => !v)
    setShowQuizMenu(false)
  }, [isCourseActive, activeCourseId, onToggleCourse])

  const handleQuizButton = useCallback(() => {
    if (isQuizActive || activeQuizId) {
      onToggleQuiz()
      setShowQuizMenu(false)
      return
    }
    setShowQuizMenu(v => !v)
    setShowCourseMenu(false)
  }, [isQuizActive, activeQuizId, onToggleQuiz])

  const handleCoursePick = useCallback((courseId: string, lessonIndex: number) => {
    onSelectCourse(courseId, lessonIndex)
    setShowCourseMenu(false)
  }, [onSelectCourse])

  const handleQuizPick = useCallback((quizId: string) => {
    onSelectQuiz(quizId)
    setShowQuizMenu(false)
  }, [onSelectQuiz])

  // Close dropdowns on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (courseMenuRef.current && !courseMenuRef.current.contains(e.target as Node)) {
        setShowCourseMenu(false)
      }
      if (quizMenuRef.current && !quizMenuRef.current.contains(e.target as Node)) {
        setShowQuizMenu(false)
      }
    }
    if (showCourseMenu || showQuizMenu) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showCourseMenu, showQuizMenu])

  useEffect(() => {
    if (!isTeacher) return

    const isEditableTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false
      if (target.isContentEditable) return true
      const tag = target.tagName.toLowerCase()
      return tag === 'input' || tag === 'textarea' || tag === 'select'
    }

    const handler = (e: KeyboardEvent) => {
      if (!e.ctrlKey || e.metaKey || e.altKey || e.shiftKey) return
      if (e.isComposing) return
      if (isEditableTarget(e.target)) return

      const key = e.key.toLowerCase()
      if (key === 'b') {
        e.preventDefault()
        onToggleBlackboard()
        return
      }

      if (key === 'c') {
        e.preventDefault()
        if (isCourseActive || activeCourseId) {
          onToggleCourse()
        } else {
          setShowCourseMenu(true)
          setShowQuizMenu(false)
        }
        return
      }

      if (key === 'q') {
        e.preventDefault()
        if (isQuizActive || activeQuizId) {
          onToggleQuiz()
        } else {
          setShowQuizMenu(true)
          setShowCourseMenu(false)
        }
      }
    }

    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [
    isTeacher,
    isCourseActive,
    activeCourseId,
    isQuizActive,
    activeQuizId,
    onToggleBlackboard,
    onToggleCourse,
    onToggleQuiz,
  ])

  return (
    <div className={`room-controls ${isMobile ? 'room-controls-mobile' : ''}`}>
      <div className="room-controls-group">
        {/* Mic */}
        <button
          className={`room-control-btn ${!isMicEnabled ? 'room-control-btn-off' : ''}`}
          onClick={toggleMic}
          title={isMicEnabled ? 'Mute microphone' : 'Unmute microphone'}
        >
          {isMicEnabled ? <Mic size={isMobile ? 18 : 20} /> : <MicOff size={isMobile ? 18 : 20} />}
          {!isMobile && <span className="room-control-label">{isMicEnabled ? 'Mute' : 'Unmute'}</span>}
        </button>

        {/* Camera */}
        <button
          className={`room-control-btn ${!isCamEnabled ? 'room-control-btn-off' : ''}`}
          onClick={toggleCam}
          title={isCamEnabled ? 'Turn off camera' : 'Turn on camera'}
        >
          {isCamEnabled ? <Video size={isMobile ? 18 : 20} /> : <VideoOff size={isMobile ? 18 : 20} />}
          {!isMobile && <span className="room-control-label">{isCamEnabled ? 'Stop Video' : 'Start Video'}</span>}
        </button>

        {/* Screen Share — hide on mobile */}
        {!isMobile && (
          <button
            className={`room-control-btn ${isScreenShareEnabled ? 'room-control-btn-active' : ''}`}
            onClick={toggleScreen}
            title={isScreenShareEnabled ? 'Stop sharing' : 'Share screen'}
          >
            {isScreenShareEnabled ? <MonitorOff size={20} /> : <Monitor size={20} />}
            <span className="room-control-label">{isScreenShareEnabled ? 'Stop Share' : 'Share Screen'}</span>
          </button>
        )}

        {/* Raise Hand (students) / Lower All Hands (teachers) */}
        {isTeacher ? (
          <button
            className={`room-control-btn ${raisedHandCount > 0 ? 'room-control-btn-hand' : ''}`}
            onClick={onLowerAllHands}
            title={`Lower all hands${raisedHandCount > 0 ? ` (${raisedHandCount})` : ''}`}
            disabled={raisedHandCount === 0}
          >
            <Hand size={isMobile ? 18 : 20} />
            {!isMobile && <span className="room-control-label">Lower All</span>}
            {raisedHandCount > 0 && (
              <span className="room-hand-badge">{raisedHandCount}</span>
            )}
          </button>
        ) : (
          <button
            className={`room-control-btn ${isHandRaised ? 'room-control-btn-hand' : ''}`}
            onClick={onToggleHand}
            title={isHandRaised ? 'Lower hand' : 'Raise hand'}
          >
            <Hand size={isMobile ? 18 : 20} />
            {!isMobile && <span className="room-control-label">{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>}
          </button>
        )}

        {/* Settings — hide on mobile */}
        {!isMobile && (
          <button className="room-control-btn" onClick={onSettings} title="Settings">
            <Settings size={20} />
            <span className="room-control-label">Settings</span>
          </button>
        )}
      </div>

      <div className="room-controls-group">
        {/* Course / Quiz / Blackboard — teacher only */}
        {isTeacher && (
          <>
            <div style={{ position: 'relative' }} ref={courseMenuRef}>
              <button
                className={`room-control-btn ${isCourseActive ? 'room-control-btn-active' : ''}`}
                onClick={handleCourseButton}
                title={isCourseActive ? 'Hide course (Ctrl+C)' : 'Show course (Ctrl+C)'}
              >
                <BookOpen size={20} />
                <span className="room-control-label">Course</span>
              </button>

              {showCourseMenu && (
                <div className="room-present-menu">
                  <div className="room-present-menu-label">Choose Course Lesson</div>
                  {linkedCourses.map((course, courseIdx) => {
                    let lessonIndexCursor = -1
                    return (
                      <div key={course.id}>
                        <div className="room-present-menu-label">{course.title}</div>
                        {course.topics.map(topic => (
                          <div key={topic.id}>
                            <div className="room-present-menu-label" style={{ paddingTop: 2, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                              {topic.title}
                            </div>
                            {topic.lessons.map(lesson => {
                              lessonIndexCursor += 1
                              const lessonIdx = lessonIndexCursor
                              return (
                                <div
                                  key={`${course.id}-${lesson.id}`}
                                  className="room-present-menu-item"
                                  onClick={() => handleCoursePick(course.id, lessonIdx)}
                                >
                                  <BookOpen size={16} />
                                  <span>{lesson.title}</span>
                                </div>
                              )
                            })}
                          </div>
                        ))}
                        {courseIdx < linkedCourses.length - 1 && <div className="room-present-menu-divider" />}
                      </div>
                    )
                  })}
                  {linkedCourses.length === 0 && (
                    <div className="room-present-menu-empty">No courses linked to this session</div>
                  )}
                </div>
              )}
            </div>

            <div style={{ position: 'relative' }} ref={quizMenuRef}>
              <button
                className={`room-control-btn ${isQuizActive ? 'room-control-btn-active' : ''}`}
                onClick={handleQuizButton}
                title={isQuizActive ? 'Hide quiz (Ctrl+Q)' : 'Show quiz (Ctrl+Q)'}
              >
                <HelpCircle size={20} />
                <span className="room-control-label">Quiz</span>
              </button>

              {showQuizMenu && (
                <div className="room-present-menu">
                  <div className="room-present-menu-label">Choose Quiz</div>
                  {linkedQuizzes.map(q => (
                    <div key={q.id} className="room-present-menu-item" onClick={() => handleQuizPick(q.id)}>
                      <HelpCircle size={16} />
                      <span>{q.title}</span>
                    </div>
                  ))}
                  {linkedQuizzes.length === 0 && (
                    <div className="room-present-menu-empty">No quizzes linked to this session</div>
                  )}
                </div>
              )}
            </div>

            <button
              className={`room-control-btn ${isBlackboardActive ? 'room-control-btn-active' : ''}`}
              onClick={onToggleBlackboard}
              title={isBlackboardActive ? 'Hide blackboard (Ctrl+B)' : 'Show blackboard (Ctrl+B)'}
            >
              <PenTool size={20} />
              <span className="room-control-label">Blackboard</span>
            </button>
          </>
        )}

        {/* Leave */}
        <button className="room-control-btn room-control-btn-leave" onClick={onLeave} title="Leave room">
          <LogOut size={isMobile ? 18 : 20} />
          {!isMobile && <span className="room-control-label">Leave</span>}
        </button>
      </div>
    </div>
  )
}

// ── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const room = useRoomContext()
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const [videoDevices, setVideoDevices] = useState<MediaDeviceInfo[]>([])
  const [selectedAudio, setSelectedAudio] = useState('')
  const [selectedVideo, setSelectedVideo] = useState('')

  useEffect(() => {
    async function loadDevices() {
      // Request permission first so labels are available
      try { await navigator.mediaDevices.getUserMedia({ audio: true, video: true }).then(s => s.getTracks().forEach(t => t.stop())) } catch {}
      const devices = await navigator.mediaDevices.enumerateDevices()
      setAudioDevices(devices.filter(d => d.kind === 'audioinput'))
      setVideoDevices(devices.filter(d => d.kind === 'videoinput'))

      // Pre-select the currently active device
      const activeMic = room.getActiveDevice('audioinput')
      const activeCam = room.getActiveDevice('videoinput')
      if (activeMic) setSelectedAudio(activeMic)
      else if (devices.find(d => d.kind === 'audioinput')) setSelectedAudio(devices.find(d => d.kind === 'audioinput')!.deviceId)
      if (activeCam) setSelectedVideo(activeCam)
      else if (devices.find(d => d.kind === 'videoinput')) setSelectedVideo(devices.find(d => d.kind === 'videoinput')!.deviceId)
    }
    loadDevices()
  }, [room])

  const handleAudioChange = useCallback(async (deviceId: string) => {
    setSelectedAudio(deviceId)
    await room.switchActiveDevice('audioinput', deviceId)
  }, [room])

  const handleVideoChange = useCallback(async (deviceId: string) => {
    setSelectedVideo(deviceId)
    await room.switchActiveDevice('videoinput', deviceId)
  }, [room])

  return (
    <div className="room-settings-overlay" onClick={onClose}>
      <div className="room-settings-modal" onClick={e => e.stopPropagation()}>
        <div className="room-settings-header">
          <h3 style={{ margin: 0, fontSize: '1rem' }}>Settings</h3>
          <button className="room-icon-btn room-icon-btn-sm" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="room-settings-body">
          {/* Microphone */}
          <div className="room-settings-section">
            <label className="room-settings-label">
              <Mic size={14} /> Microphone
            </label>
            <select
              className="input"
              value={selectedAudio}
              onChange={e => handleAudioChange(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              {audioDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Microphone ${d.deviceId.slice(0, 5)}`}</option>
              ))}
            </select>
          </div>

          {/* Camera */}
          <div className="room-settings-section">
            <label className="room-settings-label">
              <Video size={14} /> Camera
            </label>
            <select
              className="input"
              value={selectedVideo}
              onChange={e => handleVideoChange(e.target.value)}
              style={{ fontSize: '0.85rem' }}
            >
              {videoDevices.map(d => (
                <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${d.deviceId.slice(0, 5)}`}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="room-settings-footer">
          <button className="btn btn-primary btn-sm" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  )
}