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
  Check, Clock, ArrowLeft, ArrowRight, Award, Eye, Download,
  Star, Trophy, Play, Trash2, Type, AlertCircle, Copy, Pencil,
  Image, Upload, SkipForward,
} from 'lucide-react'
import Blackboard, { type BlackboardEvent, type BlackboardHandle } from '@/components/room/Blackboard'
import { createClient } from '@/lib/supabase/client'
import { getDashboardBasePath } from '@/lib/utils'
import type { Quiz, QuizQuestion as DBQuizQuestion, Course, Topic, Lesson, QuizSubmission, UserRole } from '@/lib/supabase/types'

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
type LayerKey = 'blackboard' | 'course' | 'quiz' | 'camera'

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
    | 'quiz-submit'
    | 'quiz-progress'
    | 'quiz-grade'
    | 'quiz-reveal-results'
    | 'quiz-result-countdown'
  courseId?: string
  quizId?: string
  lessonIndex?: number
  questionIndex?: number
  identity?: string
  answerIndex?: number
  scrollTop?: number
  order?: LayerKey[]
  submission?: QuizSubmission
  studentName?: string
  countdown?: number
  progress?: number
  totalQuestions?: number
}

// ── Main Page ────────────────────────────────────────────────────────────────
export default function RoomPage() {
  const params = useParams()
  const router = useRouter()
  const user = useAppStore(s => s.user)
  const basePath = getDashboardBasePath(user)
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
          <button className="btn btn-outline" onClick={() => router.push(`${basePath}/rooms`)}>← Back to Rooms</button>
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
      onDisconnected={() => router.push(`${basePath}/rooms`)}
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
  const basePath = getDashboardBasePath(user)
  const participants = useParticipants()
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, isScreenShareEnabled } = useLocalParticipant()
  const room = useRoomContext()

  // Spotlight / promotion (synced via data channel)
  const [spotlightIdentity, setSpotlightIdentity] = useState<string | null>(null)
  // Raised hands (set of participant identities)
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set())
  const initialIsMobile = typeof window !== 'undefined' ? window.innerWidth < 768 : false
  // Panel visibility tracks desktop and mobile independently.
  // Desktop panels always default to visible so resizing from mobile to desktop shows them.
  const [desktopShowParticipants, setDesktopShowParticipants] = useState(true)
  const [desktopShowChat, setDesktopShowChat] = useState(true)
  const [mobileShowParticipants, setMobileShowParticipants] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  // Blackboard
  const [blackboardActive, setBlackboardActive] = useState(false)
  const [blackboardEvent, setBlackboardEvent] = useState<BlackboardEvent | null>(null)
  const blackboardRef = useRef<BlackboardHandle>(null)
  const [allowStudentDrawing, setAllowStudentDrawing] = useState(false)
  const allowStudentDrawingRef = useRef(false)
  const prevParticipantCount = useRef(0)
  const prevPresentParticipantCount = useRef(0)
  const prevParticipantIdentitiesRef = useRef<Set<string>>(new Set())
  // Refs for data channel closure (avoid stale values)
  const isTeacherRef = useRef(false)
  const activeQuizIdRef = useRef<string | null>(null)
  const sessionIdRef = useRef<string | null>(null)
  // Keep locally revealed statuses stable while polling catches up.
  const locallyRevealedSubmissionIdsRef = useRef<Set<string>>(new Set())
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
  const [courseScrollTop, setCourseScrollTop] = useState(0)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [sessionTeacherId, setSessionTeacherId] = useState<string | null>(null)
  const [participantProfileMap, setParticipantProfileMap] = useState<Map<string, { id: string; role: UserRole }>>(new Map())
  const [quizSubmissions, setQuizSubmissions] = useState<QuizSubmission[]>([])
  const [quizSubmitted, setQuizSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState(false)
  const [revealingSubmission, setRevealingSubmission] = useState<QuizSubmission | null>(null)
  const [revealCountdown, setRevealCountdown] = useState<number | null>(null)
  // Student: track whether results have been revealed to them
  const [quizResultRevealed, setQuizResultRevealed] = useState<QuizSubmission | null>(null)
  // Track student progress: identity -> { answered, total }
  const [quizProgress, setQuizProgress] = useState<Record<string, { answered: number; total: number }>>({})
  // Track submitted students: identity -> student name (teacher awareness)
  const [submittedStudents, setSubmittedStudents] = useState<Record<string, string>>({})
  // Mobile detection – null means "not yet determined"
  const [isMobile, setIsMobile] = useState<boolean>(initialIsMobile)
  // Copy ID feedback
  const [idCopied, setIdCopied] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin'

  // Keep refs in sync for data channel closure
  isTeacherRef.current = isTeacher

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
        .select('id, teacher_id')
        .eq('room_name', roomName)
        .single()
      if (!session) return
      setSessionId(session.id)
      sessionIdRef.current = session.id
      if (session.teacher_id) setSessionTeacherId(session.teacher_id)

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

  // Participant profile map: identity (full_name) -> { id, role }
  const participantIdentityKey = useMemo(
    () => participants.map(p => p.identity).sort().join('|'),
    [participants]
  )
  useEffect(() => {
    if (participants.length === 0) return
    const load = async () => {
      const supabase = createClient()
      const identities = participants.map(p => p.identity)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, role')
        .in('full_name', identities)
      if (profiles) {
        const map = new Map<string, { id: string; role: UserRole }>()
        for (const profile of profiles) {
          if (profile.full_name) {
            map.set(profile.full_name, { id: profile.id, role: profile.role as UserRole })
          }
        }
        setParticipantProfileMap(map)
      }
    }
    load()
  }, [participantIdentityKey])

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
    // Filter out events sent by ourselves to prevent echo
    if (event.senderId && event.senderId === localParticipant.identity) return
    if (event.type === 'activate') {
      setBlackboardActive(true)
      bringLayerToFront('blackboard')
    } else if (event.type === 'deactivate') {
      setBlackboardActive(false)
      removeLayerFromOrder('blackboard')
    } else if (event.type === 'allow-drawing') {
      setAllowStudentDrawing(event.allowed)
      allowStudentDrawingRef.current = event.allowed
    } else if (event.type === 'color-change') {
      blackboardRef.current?.applyRemoteColor(event.color)
    } else if (event.type === 'stroke-change') {
      blackboardRef.current?.applyRemoteStrokeWidth(event.width)
    } else if (event.type === 'text-options-change') {
      blackboardRef.current?.applyRemoteTextOptions(event.options)
    } else if (event.type === 'tool-change') {
      // Sync the active drawing tool across all participants
      blackboardRef.current?.applyRemoteTool(event.tool)
    } else if (event.type === 'toolbar-state') {
      // Sync toolbar popup visibility (color picker, size picker, text panel)
      blackboardRef.current?.applyRemoteToolbarState({ colorPicker: event.colorPicker, sizePicker: event.sizePicker, textPanel: event.textPanel })
    } else if (
      event.type === 'drawing-live' ||
      event.type === 'drawing-live-end' ||
      event.type === 'cursor-move' ||
      event.type === 'shape-preview' ||
      event.type === 'shape-preview-end' ||
      event.type === 'text-cursor' ||
      event.type === 'object-moving' ||
      event.type === 'lock-acquire' ||
      event.type === 'lock-release' ||
      event.type === 'lock-state' ||
      event.type === 'fly-word'
    ) {
      // Live drawing / cursor / shape-preview: call imperatively to bypass React state batching
      // All participants (including co-teachers/admins) receive live draw events
      blackboardRef.current?.applyLiveEvent(event)
    } else {
      // Persistent drawing events — apply to all participants
      // A snapshot arriving means the blackboard IS active — ensure it's visible
      if (event.type === 'snapshot') {
        setBlackboardActive(true)
      }
      setBlackboardEvent(event)
    }
  })

  // Host: broadcast blackboard canvas events
  const handleBlackboardEvent = useCallback((event: BlackboardEvent) => {
    // Attach sender identity so receivers can identify the source
    const eventWithSender: BlackboardEvent = { ...event, senderId: localParticipant.identity }
    const payload = encoder.encode(JSON.stringify(eventWithSender))
    // Use unreliable transport for ephemeral preview events to avoid head-of-line blocking.
    // text-cursor is kept reliable so the hide event (visible:false) is guaranteed to arrive;
    // otherwise a dropped packet leaves the caret permanently visible on student side.
    // lock-acquire and lock-release are always reliable — they control editing access.
    const ephemeral = event.type === 'shape-preview' || event.type === 'shape-preview-end' ||
                      event.type === 'drawing-live' || event.type === 'drawing-live-end' ||
                      event.type === 'cursor-move' ||
                      event.type === 'object-moving'
    sendBlackboardData(payload, { reliable: !ephemeral })
  }, [sendBlackboardData, localParticipant.identity])

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
      activeQuizIdRef.current = event.quizId || null
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
    } else if (event.type === 'quiz-progress' && event.identity) {
      // Student is broadcasting their progress
      setQuizProgress(prev => ({ ...prev, [event.identity!]: { answered: event.progress ?? 0, total: event.totalQuestions ?? 0 } }))
    } else if (event.type === 'quiz-submit' && event.identity) {
      // A student submitted their quiz — track them as submitted and refresh
      setSubmittedStudents(prev => ({ ...prev, [event.identity!]: event.studentName || event.identity! }))
      setQuizProgress(prev => {
        const next = { ...prev }; delete next[event.identity!]; return next
      })
      // Use refs for fresh values (avoid stale closure)
      if (isTeacherRef.current && activeQuizIdRef.current && sessionIdRef.current) {
        fetch(`/api/quiz-submissions?quiz_id=${activeQuizIdRef.current}&session_id=${sessionIdRef.current}`)
          .then(r => r.json()).then(d => {
            if (d.data) {
              setQuizSubmissions(d.data.map((s: QuizSubmission) => (
                locallyRevealedSubmissionIdsRef.current.has(s.id)
                  ? { ...s, status: 'revealed' }
                  : s
              )))
            }
          })
      }
    } else if (event.type === 'quiz-reveal-results' && event.submission) {
      // Student: teacher is revealing a student's result (only show on student side)
      if (!isTeacherRef.current) {
        setRevealingSubmission(event.submission)
        setRevealCountdown(3)
      }
    } else if (event.type === 'quiz-result-countdown' && event.countdown !== undefined) {
      if (!isTeacherRef.current) {
        setRevealCountdown(event.countdown)
      }
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

  // Student: check if already submitted when quiz activates (handles reconnect / remount)
  useEffect(() => {
    if (isTeacher || !quizActive || !activeQuizId || !sessionId || !user?.id) return
    fetch(`/api/quiz-submissions?quiz_id=${activeQuizId}&session_id=${sessionId}&student_id=${user.id}`)
      .then(r => r.json())
      .then(d => {
        if (d.data && d.data.length > 0) {
          setQuizSubmitted(true)
        }
      })
      .catch(() => {})
  }, [isTeacher, quizActive, activeQuizId, sessionId, user?.id])

  // Host: toggle blackboard on/off
  const toggleBlackboard = useCallback(() => {
    const next = !blackboardActive
    setBlackboardActive(next)
    if (next) {
      bringLayerToFront('blackboard')
      // Auto-stop competing layers so students never see a stale layer
      if (quizActive) {
        setQuizActive(false)
        removeLayerFromOrder('quiz')
        sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-quiz' })), { reliable: true })
      }
      if (courseActive) {
        setCourseActive(false)
        removeLayerFromOrder('course')
        sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-course' })), { reliable: true })
      }
    } else {
      removeLayerFromOrder('blackboard')
      // Reset drawing permission when blackboard is deactivated
      setAllowStudentDrawing(false)
      allowStudentDrawingRef.current = false
    }
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
  }, [blackboardActive, quizActive, courseActive, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendBlackboardData, sendPresentData])

  // Teacher: activate course layer
  const activateCourse = useCallback((courseId: string, lessonIndex = 0) => {
    setActiveCourseId(courseId)
    setCurrentLessonIndex(lessonIndex)
    setCourseActive(true)
    bringLayerToFront('course')
    // Auto-stop quiz so students don't see a stale exam layer
    if (quizActive) {
      setQuizActive(false)
      removeLayerFromOrder('quiz')
      sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-quiz' })), { reliable: true })
    }
    updateLayerOrder('course', true)
    const payload = encoder.encode(JSON.stringify({ type: 'start-course', courseId, lessonIndex }))
    sendPresentData(payload, { reliable: true })
  }, [quizActive, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData])

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
    // Auto-stop quiz so students don't see a stale exam layer
    if (quizActive) {
      setQuizActive(false)
      removeLayerFromOrder('quiz')
      sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-quiz' })), { reliable: true })
    }
    updateLayerOrder('course', true)
    const payload = encoder.encode(JSON.stringify({
      type: 'start-course',
      courseId: activeCourseId,
      lessonIndex: currentLessonIndex,
    }))
    sendPresentData(payload, { reliable: true })
  }, [activeCourseId, courseActive, quizActive, currentLessonIndex, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData])

  // Teacher: activate quiz layer
  const activateQuiz = useCallback((quizId: string) => {
    setActiveQuizId(quizId)
    activeQuizIdRef.current = quizId
    setCurrentQuestionIndex(0)
    setQuizRevealed(false)
    setQuizAnswers({})
    setQuizSubmissions([])
    setQuizSubmitted(false)
    setSubmitError(false)
    setRevealingSubmission(null)
    setRevealCountdown(null)
    setQuizProgress({})
    setSubmittedStudents({})
    locallyRevealedSubmissionIdsRef.current = new Set()
    setQuizActive(true)
    bringLayerToFront('quiz')
    // Auto-stop course so students don't see a stale course layer
    if (courseActive) {
      setCourseActive(false)
      removeLayerFromOrder('course')
      sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-course' })), { reliable: true })
    }
    // Auto-stop blackboard so students don't see a stale board
    if (blackboardActive) {
      setBlackboardActive(false)
      removeLayerFromOrder('blackboard')
      sendBlackboardData(encoder.encode(JSON.stringify({ type: 'deactivate' })), { reliable: true })
    }
    updateLayerOrder('quiz', true)
    const payload = encoder.encode(JSON.stringify({ type: 'start-quiz', quizId, questionIndex: 0 }))
    sendPresentData(payload, { reliable: true })
  }, [courseActive, blackboardActive, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData, sendBlackboardData])

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
    // Auto-stop course so students don't see a stale course layer
    if (courseActive) {
      setCourseActive(false)
      removeLayerFromOrder('course')
      sendPresentData(encoder.encode(JSON.stringify({ type: 'stop-course' })), { reliable: true })
    }
    updateLayerOrder('quiz', true)
    const payload = encoder.encode(JSON.stringify({
      type: 'start-quiz',
      quizId: activeQuizId,
      questionIndex: currentQuestionIndex,
    }))
    sendPresentData(payload, { reliable: true })
  }, [activeQuizId, quizActive, courseActive, currentQuestionIndex, bringLayerToFront, removeLayerFromOrder, updateLayerOrder, sendPresentData])

  // Teacher: toggle camera layer — bring to front or send to back (no stream start/stop)
  const toggleCameraLayer = useCallback(() => {
    const isActive = layerOrder.includes('camera')
    updateLayerOrder('camera', !isActive)
  }, [layerOrder, updateLayerOrder])

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

  // Student: broadcast progress to teacher
  const broadcastQuizProgress = useCallback((answered: number, total: number) => {
    const payload = encoder.encode(JSON.stringify({
      type: 'quiz-progress',
      identity: localParticipant.identity,
      progress: answered,
      totalQuestions: total,
    }))
    sendPresentData(payload, { reliable: false })
  }, [localParticipant.identity, sendPresentData])

  // Student: submit all quiz answers at once
  const submitQuizAll = useCallback(async (studentAnswers: Record<number, number | string>) => {
    if (!activeQuizId || !sessionId) return
    const activeQ = linkedQuizzes.find(q => q.id === activeQuizId)
    if (!activeQ) return

    // Immediately move student to the submitted/waiting screen.
    setQuizSubmitted(true)

    const responses = activeQ.questions.map((q, i) => {
      const ans = studentAnswers[i]
      const isText = q.question_type === 'short_answer' || q.question_type === 'fill_blank'
      return {
        question_id: q.id,
        answer_index: isText ? null : (typeof ans === 'number' ? ans : null),
        answer_text: isText ? (typeof ans === 'string' ? ans.trim() : null) : null,
      }
    })

    const studentName = user?.fullName || localParticipant.identity
    const res = await fetch('/api/quiz-submissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        quiz_id: activeQuizId,
        session_id: sessionId,
        student_name: studentName,
        responses,
      }),
    })

    if (res.ok) {
      setSubmitError(false)
      // Notify everyone (especially teacher) that this student submitted
      const payload = encoder.encode(JSON.stringify({
        type: 'quiz-submit',
        identity: localParticipant.identity,
        studentName: studentName,
      }))
      sendPresentData(payload, { reliable: true })
    } else {
      // Keep student on submitted screen but surface a retry option
      setSubmitError(true)
    }
  }, [activeQuizId, sessionId, linkedQuizzes, user?.fullName, localParticipant.identity, sendPresentData])

  // Teacher: fetch quiz submissions
  const refreshSubmissions = useCallback(async () => {
    if (!activeQuizId || !sessionId) return
    const res = await fetch(`/api/quiz-submissions?quiz_id=${activeQuizId}&session_id=${sessionId}`)
    const data = await res.json()
    if (data.data) {
      setQuizSubmissions(data.data.map((s: QuizSubmission) => (
        locallyRevealedSubmissionIdsRef.current.has(s.id)
          ? { ...s, status: 'revealed' }
          : s
      )))
    }
  }, [activeQuizId, sessionId])

  // Teacher: delete a submission
  const deleteSubmission = useCallback(async (submissionId: string) => {
    const res = await fetch(`/api/quiz-submissions/${submissionId}`, { method: 'DELETE' })
    if (res.ok) refreshSubmissions()
  }, [refreshSubmissions])

  // Teacher: grade a submission
  const gradeSubmission = useCallback(async (submissionId: string, score: number, maxScore: number, teacherComment: string, passed?: boolean) => {
    const res = await fetch(`/api/quiz-submissions/${submissionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ score, max_score: maxScore, teacher_comment: teacherComment, status: 'graded', ...(passed !== undefined && { passed }) }),
    })
    if (res.ok) refreshSubmissions()
  }, [refreshSubmissions])

  // Teacher: reveal results to student only (no overlay on teacher side)
  const revealResults = useCallback(async (submission: QuizSubmission) => {
    // Send reveal to students via data channel
    const payload = encoder.encode(JSON.stringify({
      type: 'quiz-reveal-results',
      submission,
    }))
    sendPresentData(payload, { reliable: true })

    // Run countdown (sent to students only)
    let count = 3
    const interval = setInterval(() => {
      count--
      const cdPayload = encoder.encode(JSON.stringify({
        type: 'quiz-result-countdown',
        countdown: count,
      }))
      sendPresentData(cdPayload, { reliable: true })
      if (count <= 0) clearInterval(interval)
    }, 1000)

    // Optimistically update UI so button changes immediately.
    locallyRevealedSubmissionIdsRef.current.add(submission.id)
    setQuizSubmissions(prev => prev.map(s => s.id === submission.id ? { ...s, status: 'revealed' } : s))

    try {
      // Mark submission as revealed in the database
      const res = await fetch(`/api/quiz-submissions/${submission.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'revealed' }),
      })
      if (!res.ok) throw new Error('Failed to reveal submission')
      // Optimistic update (line above) + locallyRevealedSubmissionIdsRef is sufficient.
      // 5-second polling will confirm from DB — no eager refresh needed here.
    } catch (e) {
      console.error('Reveal failed:', e)
      // Do NOT remove from ref — the data channel notification already reached the student,
      // so the teacher's UI should permanently stay "✓ Revealed" for this session.
    }
  }, [sendPresentData, refreshSubmissions])

  // Dismiss result reveal — student remembers the revealed result
  const dismissReveal = useCallback(() => {
    if (revealingSubmission) {
      setQuizResultRevealed(revealingSubmission)
    }
    setRevealingSubmission(null)
    setRevealCountdown(null)
  }, [revealingSubmission])

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
        // Send current active tool so late-joiners start with the same tool
        const currentTool = blackboardRef.current?.getActiveTool()
        if (currentTool) {
          const toolPayload = encoder.encode(JSON.stringify({ type: 'tool-change', tool: currentTool, senderId: localParticipant.identity }))
          sendBlackboardData(toolPayload, { reliable: true })
        }
        // Send current toolbar settings (color, stroke, text options) so late-joiners sync
        const settings = blackboardRef.current?.getToolbarSettings()
        if (settings) {
          sendBlackboardData(encoder.encode(JSON.stringify({ type: 'color-change', color: settings.color, senderId: localParticipant.identity })), { reliable: true })
          sendBlackboardData(encoder.encode(JSON.stringify({ type: 'stroke-change', width: settings.strokeWidth, senderId: localParticipant.identity })), { reliable: true })
          sendBlackboardData(encoder.encode(JSON.stringify({ type: 'text-options-change', options: settings.textOptions, senderId: localParticipant.identity })), { reliable: true })
        }
        // Send current allow-drawing permission so late-joiners get the right state
        sendBlackboardData(encoder.encode(JSON.stringify({ type: 'allow-drawing', allowed: allowStudentDrawingRef.current })), { reliable: true })
        // Send current lock state so late-joiners know if someone is editing
        const lockState = blackboardRef.current?.getLockState()
        if (lockState) {
          sendBlackboardData(encoder.encode(JSON.stringify({ type: 'lock-state', lockedBy: lockState.lockedBy, isHost: lockState.isHost, senderId: localParticipant.identity })), { reliable: true })
        }
      }, 500)
    }
    prevParticipantCount.current = participants.length
  }, [participants.length, isTeacher, blackboardActive, sendBlackboardData])

  // Force-release blackboard lock when a participant disconnects
  useEffect(() => {
    const currentIdentities = new Set(participants.map(p => p.identity))
    const prevIdentities = prevParticipantIdentitiesRef.current
    // Check for participants who left
    for (const identity of prevIdentities) {
      if (!currentIdentities.has(identity)) {
        blackboardRef.current?.forceReleaseLock(identity)
      }
    }
    prevParticipantIdentitiesRef.current = currentIdentities
  }, [participants])

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

  // Find the session owner (room creator) to default on main stage
  const teacherParticipant = useMemo(() => {
    // Match participant whose profile ID equals the session's teacher_id
    if (sessionTeacherId) {
      const match = participants.find(p => participantProfileMap.get(p.identity)?.id === sessionTeacherId)
      if (match) return match
    }
    // Fallback: if local user is teacher/admin, show them on stage
    if (isTeacher) return localParticipant
    // Last resort: first remote participant
    const remote = participants.find(p => !p.isLocal)
    return remote || participants[0]
  }, [sessionTeacherId, participantProfileMap, isTeacher, localParticipant, participants])

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
    router.push(`${basePath}/rooms`)
  }, [room, router, basePath])

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
          participantProfileMap={participantProfileMap}
          sessionTeacherId={sessionTeacherId}
        />
      )}

      {/* Center - Main Stage */}
      <div className="room-center">
        {/* Top bar */}
        <div className="room-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && !showParticipants && (
              <button className="room-icon-btn" onClick={() => setParticipantsVisible(true)} title="Show participants (Ctrl+H)">
                <Users size={18} />
              </button>
            )}
            <div className="room-live-dot" />
            <button
              className="room-icon-btn"
              onClick={() => {
                navigator.clipboard.writeText(roomName)
                  .then(() => {
                    setIdCopied(true)
                    setTimeout(() => setIdCopied(false), 2000)
                  })
                  .catch(() => {
                    // Fallback: prompt so user can copy manually
                    window.prompt('Copy this Room ID:', roomName)
                  })
              }}
              title={roomName}
              style={{ fontSize: '0.82rem', padding: '4px 10px', display: 'flex', alignItems: 'center', gap: '5px' }}
            >
              {idCopied ? <Check size={14} /> : <Copy size={14} />}
              {idCopied ? 'Copied!' : 'Copy ID'}
            </button>
            <span className="room-live-badge">LIVE</span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              {participants.length} participant{participants.length !== 1 ? 's' : ''}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {isMobile && (
              <button className="room-icon-btn" onClick={() => setParticipantsVisible(v => !v)} title="Participants (Ctrl+H)">
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
          allowStudentDrawing={allowStudentDrawing}
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
          onSubmitQuizAll={submitQuizAll}
          localIdentity={localParticipant.identity}
          quizSubmitted={quizSubmitted}
          submitError={submitError}
          quizSubmissions={quizSubmissions}
          quizProgress={quizProgress}
          onBroadcastProgress={broadcastQuizProgress}
          submittedStudents={submittedStudents}
          onGradeSubmission={gradeSubmission}
          onDeleteSubmission={deleteSubmission}
          onRevealResults={revealResults}
          onRefreshSubmissions={refreshSubmissions}
          quizResultRevealed={quizResultRevealed}
        />

        {/* Quiz result reveal overlay */}
        {revealingSubmission && revealCountdown !== null && (
          <QuizResultReveal
            submission={revealingSubmission}
            countdown={revealCountdown}
            onDismiss={dismissReveal}
            quizTitle={activeQuiz?.title || 'Exam'}
            teacherName={teacherParticipant?.name || 'Teacher'}
          />
        )}

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
          isCameraLayerActive={layerOrder.includes('camera')}
          onToggleCameraLayer={toggleCameraLayer}
          allowStudentDrawing={allowStudentDrawing}
          onToggleAllowStudentDrawing={() => {
            const next = !allowStudentDrawing
            setAllowStudentDrawing(next)
            allowStudentDrawingRef.current = next
            const payload = encoder.encode(JSON.stringify({ type: 'allow-drawing', allowed: next }))
            sendBlackboardData(payload, { reliable: true })
          }}
        />
      </div>

      {/* Chat panel — overlay on mobile, sidebar on desktop */}
      {showChat && (
        <ChatPanel
          onClose={() => setChatVisible(false)}
          isMobile={isMobile}
          isHost={isTeacher}
          blackboardRef={blackboardRef}
          onBlackboardEvent={handleBlackboardEvent}
          blackboardActive={blackboardActive}
          onActivateBlackboard={() => {
            if (!blackboardActive) {
              setBlackboardActive(true)
              bringLayerToFront('blackboard')
              handleBlackboardEvent({ type: 'activate' })
            }
          }}
        />
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
              participantProfileMap={participantProfileMap}
              sessionTeacherId={sessionTeacherId}
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
  participantProfileMap: Map<string, { id: string; role: UserRole }>
  sessionTeacherId: string | null
}

function ParticipantsPanel({ participants, cameraTracks, spotlightIdentity, teacherIdentity, raisedHands, isTeacher, onPromote, onClose, participantProfileMap, sessionTeacherId }: ParticipantsPanelProps) {
  return (
    <div className="room-sidebar room-sidebar-left">
      <div className="room-sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Users size={16} />
          <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>Participants</span>
          <span className="room-count-badge">{participants.length}</span>
        </div>
        <button className="room-icon-btn room-icon-btn-sm" onClick={onClose} title="Hide participants (Ctrl+H)">
          <ChevronLeft size={16} />
        </button>
      </div>
      <div className="room-sidebar-body">
        {participants.map(p => {
          const camTrack = cameraTracks.find(t => t.participant?.identity === p.identity)
          const isSpotlight = spotlightIdentity === p.identity
          const handUp = raisedHands.has(p.identity)
          const profile = participantProfileMap.get(p.identity)
          return (
            <ParticipantCard
              key={p.identity}
              participant={p}
              camTrack={camTrack}
              isSpotlight={isSpotlight}
              isHandRaised={handUp}
              isTeacher={isTeacher}
              isHost={p.identity === teacherIdentity}
              participantRole={profile?.role}
              participantProfileId={profile?.id}
              sessionTeacherId={sessionTeacherId}
              onPromote={() => onPromote(p.identity)}
            />
          )
        })}
      </div>
    </div>
  )
}

// ── Participant Card ─────────────────────────────────────────────────────────
function ParticipantCard({ participant, camTrack, isSpotlight, isHandRaised, isTeacher, isHost, onPromote, participantRole, participantProfileId, sessionTeacherId }: {
  participant: LKParticipant
  camTrack?: TrackReferenceOrPlaceholder
  isSpotlight: boolean
  isHandRaised: boolean
  isTeacher: boolean
  isHost: boolean
  onPromote: () => void
  participantRole?: UserRole
  participantProfileId?: string
  sessionTeacherId?: string | null
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
        <div style={{ fontSize: '0.7rem', color: isHost ? 'var(--primary-400)' : participantRole === 'teacher' || participantRole === 'admin' ? 'var(--primary-300)' : 'var(--text-muted)' }}>
          {participant.isLocal
            ? 'You'
            : participantProfileId && sessionTeacherId && participantProfileId === sessionTeacherId
              ? 'Teacher'
              : participantRole === 'admin'
                ? 'Admin'
                : participantRole === 'teacher'
                  ? 'Teacher'
                  : 'Student'}
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
function MainStage({ participant, screenShare, cameraTracks, blackboardActive, courseActive, quizActive, layerOrder, isHost, onCanvasEvent, incomingEvent, blackboardRef, allowStudentDrawing,
  activeCourse, activeQuiz, allLessons, currentLessonIndex, currentQuestionIndex,
  quizRevealed, quizAnswers, onNavigateLesson, onScrollCourse, courseScrollTop, courseScrollRef,
  onAdvanceQuestion, onRevealAnswer, onSubmitAnswer, onSubmitQuizAll, localIdentity, onDeleteSubmission,
  quizSubmitted, submitError, quizSubmissions, quizProgress, onBroadcastProgress,
  submittedStudents,
  onGradeSubmission, onRevealResults, onRefreshSubmissions, quizResultRevealed,
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
  allowStudentDrawing: boolean
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
  onSubmitQuizAll: (answers: Record<number, number | string>) => Promise<void>
  localIdentity: string
  quizSubmitted: boolean
  submitError: boolean
  quizSubmissions: QuizSubmission[]
  quizProgress: Record<string, { answered: number; total: number }>
  onBroadcastProgress: (answered: number, total: number) => void
  submittedStudents: Record<string, string>
  onGradeSubmission: (id: string, score: number, maxScore: number, comment: string, passed?: boolean) => Promise<void>
  onDeleteSubmission: (id: string) => Promise<void>
  onRevealResults: (submission: QuizSubmission) => Promise<void>
  onRefreshSubmissions: () => Promise<void>
  quizResultRevealed: QuizSubmission | null
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
        <div
          className={`room-stage-video ${isSpeaking ? 'room-stage-speaking' : ''} ${layerOrder.includes('camera') ? `room-stage-layer ${frontLayer === 'camera' ? 'room-stage-layer-front' : 'room-stage-layer-back'}` : ''}`}
          style={{ zIndex: layerOrder.includes('camera') ? getLayerZIndex('camera') : 1 }}
        >
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
          canDraw={allowStudentDrawing}
          onCanvasEvent={onCanvasEvent}
          incomingEvent={incomingEvent}
          localIdentity={localIdentity}
        />
        {!isHost && !allowStudentDrawing && (
          <div className="room-stage-overlay">
            <div className="room-stage-label">
              <PenTool size={14} />
              <span>Blackboard — {participant?.name || 'Teacher'} is presenting</span>
            </div>
          </div>
        )}
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
            onSubmitAll={onSubmitQuizAll}
            localIdentity={localIdentity}
            teacherName={participant?.name || 'Teacher'}
            quizSubmitted={quizSubmitted}
            submitError={submitError}
            quizSubmissions={quizSubmissions}
            quizProgress={quizProgress}
            onBroadcastProgress={onBroadcastProgress}
            submittedStudents={submittedStudents}
            onGradeSubmission={onGradeSubmission}
            onDeleteSubmission={onDeleteSubmission}
            onRevealResults={onRevealResults}
            onRefreshSubmissions={onRefreshSubmissions}
            quizResultRevealed={quizResultRevealed}
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
  const [showInfo, setShowInfo] = useState(false)
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Prevent wheel events from propagating to browser (avoids page zoom)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    if (!isHost || !contentRef.current) return
    const el = contentRef.current
    const maxScroll = el.scrollHeight - el.clientHeight
    if (maxScroll > 0) {
      e.stopPropagation()
    }
  }, [isHost])

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

  const handleInfoEnter = () => {
    if (hideTimerRef.current) clearTimeout(hideTimerRef.current)
    setShowInfo(true)
  }
  const handleInfoLeave = () => {
    hideTimerRef.current = setTimeout(() => setShowInfo(false), 200)
  }

  return (
    <div className="room-presentation">
      {/* Floating book icon — top-left; hover reveals course/topic/lesson info */}
      <div
        className="room-pres-info-trigger"
        onMouseEnter={handleInfoEnter}
        onMouseLeave={handleInfoLeave}
      >
        <div className="room-pres-info-icon"><BookOpen size={15} /></div>
        {showInfo && (
          <div className="room-pres-info-panel">
            <div className="room-pres-info-course">{course.title}</div>
            {currentTopic && <div className="room-pres-info-topic">{currentTopic.title}</div>}
            {lesson && <div className="room-pres-info-lesson">{lesson.title}</div>}
            <div className="room-pres-info-counter">{currentIndex + 1} / {totalLessons}</div>
            {!isHost && <div className="room-pres-info-presenter">{teacherName} is presenting</div>}
            {isHost && (
              <div className="room-pres-lesson-picker">
                {(() => {
                  let idx = 0
                  return course.topics.map(topic => (
                    <div key={topic.id}>
                      <div className="room-pres-picker-topic">{topic.title}</div>
                      {topic.lessons.map(l => {
                        const li = idx++
                        return (
                          <button
                            key={l.id}
                            className={'room-pres-picker-lesson' + (li === currentIndex ? ' active' : '')}
                            onClick={() => { onNavigate(li); setShowInfo(false) }}
                          >
                            {l.title}
                          </button>
                        )
                      })}
                    </div>
                  ))
                })()}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Full-height scrollable content — fills all space */}
      <div
        ref={(el) => {
          contentRef.current = el
          if (scrollRef) scrollRef.current = el
        }}
        className="room-presentation-content"
        onScroll={isHost ? handleScroll : undefined}
        onWheel={isHost ? handleWheel : undefined}
        style={!isHost ? { overflow: 'hidden' } : undefined}
      >
        {lesson ? (
          <>
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

      {/* Corner nav arrows — host only */}
      {isHost && (
        <>
          <button
            className="room-pres-nav-btn room-pres-nav-prev"
            disabled={currentIndex === 0}
            onClick={() => onNavigate(currentIndex - 1)}
            aria-label="Previous lesson"
          >
            <ChevronLeft size={20} />
          </button>
          <button
            className="room-pres-nav-btn room-pres-nav-next"
            disabled={currentIndex >= totalLessons - 1}
            onClick={() => onNavigate(currentIndex + 1)}
            aria-label="Next lesson"
          >
            <ChevronRight size={20} />
          </button>
        </>
      )}
    </div>
  )
}

// ── Quiz Presentation ────────────────────────────────────────────────────────
function QuizPresentation({ quiz, currentIndex, revealed, answers, isHost, onAdvance, onReveal, onAnswer, onSubmitAll, localIdentity, teacherName,
  quizSubmitted, submitError, quizSubmissions, quizProgress, onBroadcastProgress,
  submittedStudents,
  onGradeSubmission, onDeleteSubmission, onRevealResults, onRefreshSubmissions, quizResultRevealed,
}: {
  quiz: LinkedQuiz
  currentIndex: number
  revealed: boolean
  answers: Record<string, number>
  isHost: boolean
  onAdvance: (index: number) => void
  onReveal: () => void
  onAnswer: (index: number) => void
  onSubmitAll: (answers: Record<number, number | string>) => Promise<void>
  localIdentity: string
  teacherName: string
  quizSubmitted: boolean
  submitError: boolean
  quizSubmissions: QuizSubmission[]
  quizProgress: Record<string, { answered: number; total: number }>
  onBroadcastProgress: (answered: number, total: number) => void
  submittedStudents: Record<string, string>
  onGradeSubmission: (id: string, score: number, maxScore: number, comment: string, passed?: boolean) => Promise<void>
  onDeleteSubmission: (id: string) => Promise<void>
  onRevealResults: (submission: QuizSubmission) => Promise<void>
  onRefreshSubmissions: () => Promise<void>
  quizResultRevealed: QuizSubmission | null
}) {
  const totalQuestions = quiz.questions.length

  // Students navigate independently; teacher uses the shared currentIndex
  const [studentIndex, setStudentIndex] = useState(0)
  // Students track their own answers locally per question index
  const [studentAnswers, setStudentAnswers] = useState<Record<number, number | string>>({})
  const [submitting, setSubmitting] = useState(false)
  // Student: "Join Quiz" gate — must click to enter
  const [quizJoined, setQuizJoined] = useState(false)

  // ── Teacher grading page state ──
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [responsesMap, setResponsesMap] = useState<Record<string, Array<{ id: string; question_id: string; answer_index: number | null; answer_text: string | null; is_correct: boolean | null; score: number | null; sort_order?: number }>>>({})
  const [scoresMap, setScoresMap] = useState<Record<string, Record<number, number>>>({})
  const [commentsMap, setCommentsMap] = useState<Record<string, string>>({})
  const [passedMap, setPassedMap] = useState<Record<string, boolean>>({})
  const [deleting, setDeleting] = useState<string | null>(null)
  const [grading, setGrading] = useState<string | null>(null)
  const [revealing, setRevealing] = useState<string | null>(null)
  const [loadingResponses, setLoadingResponses] = useState<string | null>(null)

  const gradeOptionLabels = ['A', 'B', 'C', 'D', 'E', 'F']

  // Open dedicated grading page and load responses
  const openGradingPage = useCallback(async (sub: QuizSubmission) => {
    setExpandedId(sub.id)
    setCommentsMap(prev => ({ ...prev, [sub.id]: prev[sub.id] ?? sub.teacher_comment ?? '' }))
    setPassedMap(prev => ({ ...prev, [sub.id]: prev[sub.id] ?? sub.passed }))
    if (responsesMap[sub.id]) return
    setLoadingResponses(sub.id)
    try {
      const res = await fetch(`/api/quiz-responses?submission_id=${sub.id}`)
      const d = await res.json()
      if (d.data) {
        setResponsesMap(prev => ({ ...prev, [sub.id]: d.data }))
        const scores: Record<number, number> = {}
        for (let i = 0; i < quiz.questions.length; i++) {
          const resp = d.data[i] || null
          const pts = quiz.questions[i].points || 1
          if (resp?.score != null) scores[i] = resp.score
          else if (resp?.is_correct === true) scores[i] = pts
          else if (resp?.is_correct === false) scores[i] = 0
        }
        setScoresMap(prev => ({ ...prev, [sub.id]: scores }))
      }
    } finally { setLoadingResponses(null) }
  }, [responsesMap, quiz.questions])

  const closeGradingPage = useCallback(() => {
    setExpandedId(null)
  }, [])

  const getComputedScore = useCallback((subId: string) => {
    const questionScores = scoresMap[subId] || {}
    let score = 0, maxScore = 0
    for (let idx = 0; idx < quiz.questions.length; idx++) {
      const pts = quiz.questions[idx].points || 1
      maxScore += pts
      score += questionScores[idx] ?? 0
    }
    return { score, maxScore, percentage: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0 }
  }, [quiz.questions, scoresMap])

  const handleGrade = useCallback(async (sub: QuizSubmission) => {
    setGrading(sub.id)
    try {
      const responses = responsesMap[sub.id] || []
      const questionScores = scoresMap[sub.id] || {}
      // Only PATCH responses for teacher-scored (text) questions — MCQ scores
      // are already stored at submit time, so re-patching them is unnecessary
      // and causes N slow auth+DB round-trips that make grading appear to hang.
      const textPatches = responses
        .map((resp, idx) => {
          const q = quiz.questions[idx]
          const isTextQuestion = q?.question_type === 'short_answer' || q?.question_type === 'fill_blank'
          if (!isTextQuestion || !resp?.id) return null
          const pts = questionScores[idx]
          if (pts == null) return null
          const maxPts = q?.points || 1
          return fetch(`/api/quiz-responses/${resp.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_correct: pts >= maxPts, score: pts }),
          })
        })
        .filter(Boolean)
      if (textPatches.length > 0) await Promise.all(textPatches)
      const computed = getComputedScore(sub.id)
      await onGradeSubmission(sub.id, computed.score, computed.maxScore, commentsMap[sub.id] || '', passedMap[sub.id])
      setExpandedId(null)
    } catch (e) {
      console.error('Grading failed:', e)
    } finally { setGrading(null) }
  }, [responsesMap, scoresMap, quiz.questions, getComputedScore, onGradeSubmission, commentsMap, passedMap])

  const handleSaveComment = useCallback(async (sub: QuizSubmission) => {
    setGrading(sub.id)
    try {
      await onGradeSubmission(sub.id, sub.score, sub.max_score, commentsMap[sub.id] || '', passedMap[sub.id])
      setExpandedId(null)
    } finally { setGrading(null) }
  }, [onGradeSubmission, commentsMap, passedMap])

  const handleReveal = useCallback(async (sub: QuizSubmission) => {
    if (revealing === sub.id) return
    setRevealing(sub.id)
    try {
      await onRevealResults(sub)
    } finally {
      setRevealing(null)
    }
  }, [onRevealResults, revealing])

  // Teacher: poll for submissions every 5 seconds (data channel may be unreliable)
  useEffect(() => {
    if (!isHost) return
    onRefreshSubmissions()
    const interval = setInterval(() => { onRefreshSubmissions() }, 5000)
    return () => clearInterval(interval)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isHost])

  // Teacher: derive submitted list by merging data channel + API submissions
  const allSubmitted = useMemo(() => {
    const merged: Record<string, string> = { ...submittedStudents }
    for (const sub of quizSubmissions) {
      // Use student_id as key, student_name as value — avoid duplicates
      const alreadyTracked = Object.values(merged).some(name => name === sub.student_name)
      if (!alreadyTracked) {
        merged[sub.student_id || sub.student_name] = sub.student_name
      }
    }
    return merged
  }, [submittedStudents, quizSubmissions])

  // Set of all submitted names — used to filter out working students whose identity
  // key might not match the student_id key used in allSubmitted (e.g. data channel
  // identity is a display name but API student_id is a UUID).
  const allSubmittedNames = useMemo(() => new Set(Object.values(allSubmitted)), [allSubmitted])

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
  const answeredCount = Object.keys(studentAnswers).length

  // Student: answer the current question (locally only, no broadcast)
  const handleStudentAnswer = useCallback((optionIndex: number) => {
    setStudentAnswers(prev => {
      const next = { ...prev, [activeIndex]: optionIndex }
      // Broadcast progress to teacher
      onBroadcastProgress(Object.keys(next).length, totalQuestions)
      return next
    })
  }, [activeIndex, onBroadcastProgress, totalQuestions])

  // Student: text answer for short_answer / fill_blank questions
  const handleStudentTextAnswer = useCallback((text: string) => {
    setStudentAnswers(prev => {
      const next = { ...prev }
      if (text.trim()) {
        next[activeIndex] = text
      } else {
        delete next[activeIndex]
      }
      onBroadcastProgress(Object.keys(next).length, totalQuestions)
      return next
    })
  }, [activeIndex, onBroadcastProgress, totalQuestions])

  // Student: submit all answers
  const handleSubmitAll = useCallback(async () => {
    setSubmitting(true)
    try {
      await onSubmitAll(studentAnswers)
    } finally {
      setSubmitting(false)
    }
  }, [studentAnswers, onSubmitAll])

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

  // Student: quiz already submitted
  if (!isHost && quizSubmitted) {
    // If results have been revealed, show the result summary
    if (quizResultRevealed) {
      const sub = quizResultRevealed
      return <StudentRevealedResult sub={sub} quizTitle={quiz.title} />
    }

    // Default: waiting for teacher (or retry on error)
    return (
      <div className="room-presentation">
        <div className="room-presentation-header">
          <HelpCircle size={16} />
          <span className="room-presentation-title">{quiz.title}</span>
        </div>
        <div className="room-presentation-content room-quiz-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
          {submitError ? (
            <>
              <div className="room-quiz-submitted-icon" style={{ color: 'var(--error-400)' }}>
                <AlertCircle size={48} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Submission Failed</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                Could not save your answers. Please try again.
              </p>
              <button
                className="btn btn-primary"
                disabled={submitting}
                onClick={() => { void onSubmitAll(studentAnswers) }}
              >
                {submitting ? 'Retrying...' : 'Retry Submission'}
              </button>
            </>
          ) : (
            <>
              <div className="room-quiz-submitted-icon">
                <Check size={48} />
              </div>
              <h2 style={{ margin: 0, fontSize: '1.2rem' }}>Exam Submitted!</h2>
              <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center' }}>
                Your exam has been submitted. Thank you for participating.{' '}
                {quiz.reveal_delay_days
                  ? `Results will be revealed in ${quiz.reveal_delay_days} day${quiz.reveal_delay_days !== 1 ? 's' : ''}.`
                  : 'Results will be revealed by your teacher.'}
              </p>
              <div className="room-quiz-submitted-pulse" />
            </>
          )}
        </div>
      </div>
    )
  }

  // ── Student: "Join Quiz" landing screen ──
  if (!isHost && !quizJoined) {
    return (
      <div className="room-presentation">
        <div className="room-presentation-header">
          <HelpCircle size={16} />
          <span className="room-presentation-title">{quiz.title}</span>
        </div>
        <div className="room-presentation-content room-quiz-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '32px 16px' }}>
          <div className="room-quiz-join-icon">
            <HelpCircle size={48} />
          </div>
          <h2 style={{ margin: 0, fontSize: '1.3rem', textAlign: 'center' }}>{quiz.title}</h2>
          <div className="room-quiz-join-info">
            <span>{totalQuestions} question{totalQuestions !== 1 ? 's' : ''}</span>
            <span>•</span>
            <span>By {teacherName}</span>
          </div>
          <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontSize: '0.88rem', maxWidth: 340 }}>
            When you&apos;re ready, click the button below to start. You can navigate questions at your own pace and submit when done.
          </p>
          <button className="btn btn-primary" style={{ padding: '10px 32px', fontSize: '1rem' }} onClick={() => setQuizJoined(true)}>
            <Play size={18} /> Start Exam
          </button>
        </div>
      </div>
    )
  }

  // ── Teacher: Live monitoring dashboard with inline grading ──
  if (isHost) {
    const workingStudents = Object.entries(quizProgress).filter(([id]) => !allSubmitted[id] && !allSubmittedNames.has(id))
    const submittedList = Object.entries(allSubmitted)
    const totalParticipants = workingStudents.length + submittedList.length
    const gradingSubmission = expandedId ? quizSubmissions.find(s => s.id === expandedId) ?? null : null

    if (gradingSubmission) {
      const responses = responsesMap[gradingSubmission.id] || []
      const questionScores = scoresMap[gradingSubmission.id] || {}
      const computed = getComputedScore(gradingSubmission.id)
      const pageTitle = gradingSubmission.student_name || 'Student'

      return (
        <div className="room-presentation">
          <div className="room-presentation-header">
            <Award size={16} />
            <span className="room-presentation-title">Grade: {pageTitle}</span>
            <button className="btn btn-outline btn-sm" style={{ marginLeft: 'auto' }} onClick={closeGradingPage}>
              <ArrowLeft size={14} /> Back
            </button>
          </div>

          <div className="room-presentation-content room-grading-content">
            {loadingResponses === gradingSubmission.id ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-muted)' }}>Loading responses...</div>
            ) : (
              <>
                {(gradingSubmission.status === 'graded' || gradingSubmission.status === 'revealed') && (
                  <div className="room-grading-summary">
                    <div className="room-grading-summary-bar">
                      <div className="room-grading-summary-fill" style={{ width: `${gradingSubmission.percentage}%`, background: gradingSubmission.percentage >= 70 ? 'var(--success-500)' : 'var(--error-400)' }} />
                    </div>
                    <div className="room-grading-summary-stats">
                      <span>Score: {gradingSubmission.score}/{gradingSubmission.max_score} points</span>
                      <span>{gradingSubmission.percentage}% — {gradingSubmission.passed ? 'Passed' : 'Not Passed'}</span>
                    </div>
                  </div>
                )}


                <div className="room-grading-questions">
                  {quiz.questions.map((q, qi) => {
                    const resp = responses[qi] || null
                    const studentAnswer = resp?.answer_index
                    const studentText = resp?.answer_text
                    const isTextQuestion = q.question_type === 'short_answer' || q.question_type === 'fill_blank'
                    const pts = q.points || 1
                    const earned = questionScores[qi] ?? 0
                    const hasScore = questionScores[qi] != null
                    const isFullCorrect = earned >= pts
                    const isWrong = hasScore && earned === 0

                    return (
                      <div key={q.id} className={`room-grading-question ${isFullCorrect ? 'room-grading-question-correct' : isWrong ? 'room-grading-question-wrong' : hasScore && earned > 0 ? 'room-grading-question-partial' : ''}`}>
                        <div className="room-grading-q-header">
                          <span className="room-quiz-question-number">Q{qi + 1}</span>
                          <span className="room-quiz-question-text" style={{ fontSize: '0.9rem', flex: 1 }}>{q.question_text}</span>
                          {isTextQuestion && (
                            <span className="room-grading-opt-tag" style={{ background: 'rgba(139,92,246,0.15)', color: 'var(--primary-400)' }}>
                              <Type size={11} /> Text
                            </span>
                          )}
                          <span className={`room-grading-q-points ${isFullCorrect ? 'room-grading-q-points-earned' : isWrong ? 'room-grading-q-points-lost' : hasScore && earned > 0 ? 'room-grading-q-points-partial' : ''}`}>
                            {earned}/{pts} pts
                          </span>
                          {hasScore && (
                            <span className={isFullCorrect ? 'room-grading-correct' : isWrong ? 'room-grading-wrong' : 'room-grading-partial'}>
                              {isFullCorrect ? '✓' : isWrong ? '✗' : '~'}
                            </span>
                          )}
                        </div>

                        {isTextQuestion ? (
                          <div className="room-grading-text-answer">
                            <div className="room-grading-text-row">
                              <span className="room-grading-text-label">Student&apos;s Answer:</span>
                              <div className={`room-grading-text-value ${isFullCorrect ? 'room-grading-text-correct' : isWrong ? 'room-grading-text-wrong' : ''}`}>
                                {studentText || <em style={{ color: 'var(--text-muted)' }}>No answer provided</em>}
                              </div>
                            </div>
                            {q.correct_answer && (
                              <div className="room-grading-text-row">
                                <span className="room-grading-text-label">Expected Answer:</span>
                                <div className="room-grading-text-value room-grading-text-correct">{q.correct_answer}</div>
                              </div>
                            )}
                            {gradingSubmission.status !== 'revealed' && (
                              <div className="room-grading-text-actions">
                                <div className="room-grading-score-input">
                                  <label style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Points:</label>
                                  <input
                                    type="number" min={0} max={pts} step={1}
                                    value={questionScores[qi] ?? ''}
                                    onChange={e => {
                                      const v = e.target.value === '' ? undefined : Math.min(pts, Math.max(0, Number(e.target.value)))
                                      setScoresMap(prev => {
                                        const cur = { ...prev[gradingSubmission.id] }
                                        if (v == null) delete cur[qi]; else cur[qi] = v
                                        return { ...prev, [gradingSubmission.id]: cur }
                                      })
                                    }}
                                    className="room-grading-pts-input"
                                    placeholder="0"
                                  />
                                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>/ {pts}</span>
                                </div>
                                <button className="btn btn-sm" style={{ background: 'rgba(34,197,94,0.15)', color: 'var(--success-400)', border: '1px solid var(--success-400)' }}
                                  onClick={() => setScoresMap(prev => ({ ...prev, [gradingSubmission.id]: { ...prev[gradingSubmission.id], [qi]: pts } }))}>
                                  <Check size={13} /> Full
                                </button>
                                <button className="btn btn-sm" style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--error-400)', border: '1px solid var(--error-400)' }}
                                  onClick={() => setScoresMap(prev => ({ ...prev, [gradingSubmission.id]: { ...prev[gradingSubmission.id], [qi]: 0 } }))}>
                                  <X size={13} /> Zero
                                </button>
                              </div>
                            )}
                          </div>
                        ) : (
                          <div className="room-grading-q-options">
                            {q.options.map((opt, oi) => {
                              const isCorrectOption = oi === q.correct_index
                              const isStudentPick = oi === studentAnswer
                              let cls = 'room-grading-q-opt'
                              if (isCorrectOption) cls += ' room-grading-q-opt-correct'
                              if (isStudentPick && !isCorrectOption) cls += ' room-grading-q-opt-wrong'
                              return (
                                <div key={oi} className={cls}>
                                  <span className="room-quiz-option-label">{gradeOptionLabels[oi]}</span>
                                  <span style={{ flex: 1 }}>{opt}</span>
                                  {isCorrectOption && (
                                    <span className="room-grading-opt-tag room-grading-opt-tag-correct"><Check size={11} /> Correct</span>
                                  )}
                                  {isStudentPick && (
                                    <span className={`room-grading-opt-tag ${isCorrectOption ? 'room-grading-opt-tag-correct' : 'room-grading-opt-tag-wrong'}`}>Student&apos;s Pick</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>

                <div className="room-grading-comment">
                  <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Teacher Comment</label>
                  <textarea
                    className="room-grading-textarea"
                    value={commentsMap[gradingSubmission.id] ?? ''}
                    onChange={e => setCommentsMap(prev => ({ ...prev, [gradingSubmission.id]: e.target.value }))}
                    placeholder="Add a comment for this student..."
                    rows={2}
                  />
                </div>

                <div className="room-grading-actions">
                  {gradingSubmission.status !== 'revealed' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginRight: 'auto' }}>
                      <button
                        className={`btn btn-sm ${passedMap[gradingSubmission.id] ? 'room-grading-pass-active' : 'btn-outline'}`}
                        onClick={() => setPassedMap(prev => ({ ...prev, [gradingSubmission.id]: true }))}
                      >
                        <Check size={13} /> Pass
                      </button>
                      <button
                        className={`btn btn-sm ${passedMap[gradingSubmission.id] === false ? 'room-grading-fail-active' : 'btn-outline'}`}
                        onClick={() => setPassedMap(prev => ({ ...prev, [gradingSubmission.id]: false }))}
                      >
                        <X size={13} /> Fail
                      </button>
                    </div>
                  )}
                  {gradingSubmission.status === 'submitted' ? (
                    <button className="btn btn-primary" disabled={grading === gradingSubmission.id} onClick={() => handleGrade(gradingSubmission)}>
                      {grading === gradingSubmission.id ? 'Saving Results...' : `Save Results (${computed.score}/${computed.maxScore})`}
                    </button>
                  ) : gradingSubmission.status === 'graded' ? (
                    <>
                      {(commentsMap[gradingSubmission.id] ?? '') !== (gradingSubmission.teacher_comment || '') && (
                        <button className="btn btn-outline" disabled={grading === gradingSubmission.id} onClick={() => handleSaveComment(gradingSubmission)}>
                          {grading === gradingSubmission.id ? 'Saving Results...' : 'Save Results'}
                        </button>
                      )}
                      <button className="btn btn-primary" disabled={revealing === gradingSubmission.id} onClick={() => handleReveal(gradingSubmission)}>
                        <Trophy size={14} /> {revealing === gradingSubmission.id ? 'Revealing...' : 'Reveal to Student'}
                      </button>
                    </>
                  ) : (
                    <span className="room-grading-status-revealed" style={{ fontSize: '0.85rem' }}>✓ Results already revealed</span>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )
    }

    return (
      <div className="room-presentation">
        <div className="room-presentation-header">
          <HelpCircle size={16} />
          <span className="room-presentation-title">{quiz.title}</span>
          <span className="room-presentation-counter" style={{ marginLeft: 'auto' }}>
            Q{currentIndex + 1}/{totalQuestions}
          </span>
        </div>

        <div className="room-presentation-content room-teacher-dashboard">
          {/* Stats summary */}
          <div className="room-teacher-stats">
            <div className="room-teacher-stat">
              <span className="room-teacher-stat-value">{totalParticipants}</span>
              <span className="room-teacher-stat-label">Participants</span>
            </div>
            <div className="room-teacher-stat">
              <span className="room-teacher-stat-value" style={{ color: 'var(--warning-500)' }}>{workingStudents.length}</span>
              <span className="room-teacher-stat-label">Working</span>
            </div>
            <div className="room-teacher-stat">
              <span className="room-teacher-stat-value" style={{ color: 'var(--success-400)' }}>{submittedList.length}</span>
              <span className="room-teacher-stat-label">Submitted</span>
            </div>
            <div className="room-teacher-stat">
              <span className="room-teacher-stat-value" style={{ color: 'var(--primary-400)' }}>{quizSubmissions.filter(s => s.status === 'graded' || s.status === 'revealed').length}</span>
              <span className="room-teacher-stat-label">Graded</span>
            </div>
          </div>

          {/* Participant list */}
          <div className="room-teacher-participants">
            {totalParticipants === 0 && (
              <div className="room-presentation-empty" style={{ padding: '32px 16px' }}>
                <Users size={32} style={{ opacity: 0.4, marginBottom: 8 }} />
                <p>Waiting for students to join the quiz...</p>
              </div>
            )}

            {/* Submitted students — shown first */}
            {submittedList.map(([identity, name]) => {
              const submission = quizSubmissions.find(s => s.student_name === name || s.student_name === identity)

              return (
                <div key={identity} className={`room-grading-item-card ${submission && (submission.status === 'graded' || submission.status === 'revealed') ? 'room-grading-item-graded' : ''}`}>
                  {/* Row header */}
                  <div className="room-grading-item">
                    <div className="room-grading-item-info">
                      <span className="room-grading-item-name">{name || identity}</span>
                      {submission ? (
                        <>
                          {(submission.status === 'graded' || submission.status === 'revealed') ? (
                            <span className="room-grading-item-status room-grading-status-graded">
                              {submission.score}/{submission.max_score} ({submission.percentage}%)
                            </span>
                          ) : (
                            <span className="room-grading-item-status room-grading-status-submitted">submitted</span>
                          )}
                          {submission.status === 'revealed' && (
                            <span className="room-grading-item-status room-grading-status-revealed">✓ Revealed</span>
                          )}
                        </>
                      ) : (
                        <span className="room-teacher-participant-badge room-teacher-badge-submitted">
                          <Check size={12} /> Submitted
                        </span>
                      )}
                    </div>
                    <div className="room-grading-item-actions" onClick={e => e.stopPropagation()}>
                      {submission && submission.status === 'submitted' && (
                        <button className="btn btn-primary btn-sm" onClick={() => openGradingPage(submission)}>
                          <Award size={14} /> Grade
                        </button>
                      )}
                      {submission && submission.status === 'graded' && (
                        <button className="btn btn-outline btn-sm" onClick={() => openGradingPage(submission)}>
                          <Award size={14} /> Open Grade
                        </button>
                      )}
                      {submission && submission.status === 'graded' && (
                        <button className="btn btn-primary btn-sm" disabled={revealing === submission.id} onClick={() => handleReveal(submission)}>
                          <Trophy size={14} /> {revealing === submission.id ? 'Revealing...' : 'Reveal'}
                        </button>
                      )}
                      {submission && submission.status === 'revealed' && (
                        <span className="room-grading-status-revealed" style={{ fontSize: '0.8rem' }}>✓ Revealed</span>
                      )}
                      {submission && (
                        <button
                          className="btn btn-ghost btn-icon btn-sm"
                          style={{ color: 'var(--danger-400)' }}
                          disabled={deleting === submission.id}
                          onClick={async () => { setDeleting(submission.id); await onDeleteSubmission(submission.id); setDeleting(null) }}
                          aria-label="Delete submission"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              )
            })}

            {/* Working students */}
            {workingStudents.map(([identity, p]) => (
              <div key={identity} className="room-teacher-participant">
                <div className="room-teacher-participant-info">
                  <span className="room-teacher-participant-name">{identity}</span>
                  <span className="room-teacher-participant-badge room-teacher-badge-working">
                    Working...
                  </span>
                </div>
                <div style={{ flex: 1, maxWidth: 160, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div className="room-quiz-progress-track" style={{ flex: 1 }}>
                    <div className="room-quiz-progress-fill" style={{ width: `${p.total > 0 ? (p.answered / p.total) * 100 : 0}%` }} />
                  </div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{p.answered}/{p.total}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Teacher navigation controls */}
        <div className="room-presentation-nav">
          <button
            className="btn btn-outline btn-sm"
            disabled={currentIndex === 0}
            onClick={() => onAdvance(currentIndex - 1)}
          >
            <ArrowLeft size={16} /> Prev
          </button>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Showing Q{currentIndex + 1} to students
          </span>
          <button
            className="btn btn-outline btn-sm"
            disabled={currentIndex >= totalQuestions - 1}
            onClick={() => onAdvance(currentIndex + 1)}
          >
            Next <ArrowRight size={16} />
          </button>
        </div>
      </div>
    )
  }

  // ── Student quiz view ──
  return (
    <div className="room-presentation">
      <div className="room-presentation-header">
        <HelpCircle size={16} />
        <span className="room-presentation-title">{quiz.title}</span>
        <span className="room-presentation-subtitle">{teacherName} is presenting</span>
        <span className="room-presentation-counter" style={{ marginLeft: 'auto' }}>
          Q{activeIndex + 1}/{totalQuestions}
        </span>
      </div>

      <div className="room-presentation-content room-quiz-content">
        <div className="room-quiz-question">
          <span className="room-quiz-question-number">Question {activeIndex + 1}</span>
          <h2 className="room-quiz-question-text">{question.question_text}</h2>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center', justifyContent: 'center' }}>
            {question.time_limit > 0 && (
              <div className="room-quiz-timer">
                <Clock size={14} /> {question.time_limit}s
              </div>
            )}
            {question.points > 1 && (
              <div className="room-quiz-timer" style={{ color: 'var(--primary-400)' }}>
                <Star size={14} /> {question.points} pts
              </div>
            )}
          </div>
        </div>

        {(question.question_type === 'short_answer' || question.question_type === 'fill_blank') ? (
          <div className="room-quiz-text-input">
            <textarea
              className="room-quiz-text-area"
              value={typeof studentAnswers[activeIndex] === 'string' ? (studentAnswers[activeIndex] as string) : ''}
              onChange={e => handleStudentTextAnswer(e.target.value)}
              placeholder={question.question_type === 'fill_blank' ? 'Type your answer...' : 'Write your answer here...'}
              rows={4}
            />
          </div>
        ) : (
          <div className="room-quiz-options">
            {question.options.map((opt, i) => {
              const isMyAnswer = myAnswer === i

              let optClass = 'room-quiz-option'
              if (isMyAnswer) optClass += ' room-quiz-option-selected'

              return (
                <button
                  key={i}
                  className={optClass}
                  onClick={() => handleStudentAnswer(i)}
                >
                  <span className="room-quiz-option-label">{optionLabels[i]}</span>
                  <span className="room-quiz-option-text">{opt}</span>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Student self-paced navigation + submit button */}
      <div className="room-presentation-nav">
        <button
          className="btn btn-outline btn-sm"
          disabled={studentIndex === 0}
          onClick={() => setStudentIndex(prev => prev - 1)}
        >
          <ArrowLeft size={16} /> Prev
        </button>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="room-presentation-counter">
            {answeredCount}/{totalQuestions}
          </span>
          <button
            className="btn btn-primary btn-sm"
            disabled={answeredCount < totalQuestions || submitting}
            onClick={handleSubmitAll}
          >
            {submitting ? 'Submitting...' : answeredCount < totalQuestions ? `${answeredCount}/${totalQuestions} answered` : 'Submit Exam'}
          </button>
        </div>
        <button
          className="btn btn-outline btn-sm"
          disabled={studentIndex >= totalQuestions - 1}
          onClick={() => setStudentIndex(prev => prev + 1)}
        >
          Next <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}

// ── Student Revealed Result (with animated count-up) ─────────────────────────
function StudentRevealedResult({ sub, quizTitle }: { sub: QuizSubmission; quizTitle: string }) {
  const [displayPct, setDisplayPct] = useState(0)
  const [displayScore, setDisplayScore] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const duration = 3000
    const fps = 60
    const totalFrames = Math.round((duration / 1000) * fps)
    let frame = 0
    const timer = setInterval(() => {
      frame++
      const progress = frame / totalFrames
      const eased = 1 - Math.pow(1 - progress, 3)
      setDisplayPct(Math.round(eased * sub.percentage))
      setDisplayScore(Math.round(eased * sub.score))
      if (frame >= totalFrames) {
        clearInterval(timer)
        setDisplayPct(sub.percentage)
        setDisplayScore(sub.score)
        setDone(true)
      }
    }, 1000 / fps)
    return () => clearInterval(timer)
  }, [sub.percentage, sub.score])

  const passColor = sub.passed ? 'var(--success-400)' : 'var(--error-400)'

  return (
    <div className="room-presentation">
      <div className="room-presentation-header">
        <Trophy size={16} />
        <span className="room-presentation-title">{quizTitle}</span>
        <span className="room-presentation-subtitle">Exam Results</span>
      </div>
      <div className="room-presentation-content room-quiz-content" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20, padding: '24px 16px' }}>
        <div style={{ position: 'relative', width: 140, height: 140 }}>
          <svg width={140} height={140} viewBox="0 0 140 140">
            <circle cx={70} cy={70} r={60} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={10} />
            <circle
              cx={70} cy={70} r={60} fill="none"
              stroke={passColor}
              strokeWidth={10}
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 60}
              strokeDashoffset={2 * Math.PI * 60 * (1 - displayPct / 100)}
              transform="rotate(-90 70 70)"
              style={{ transition: 'stroke 0.3s' }}
            />
          </svg>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: passColor, lineHeight: 1 }}>{displayPct}%</span>
          </div>
        </div>

        <h2 style={{ margin: 0, fontSize: '1.3rem' }}>
          {done ? (sub.passed ? 'Congratulations!' : 'Quiz Complete') : 'Calculating...'}
        </h2>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700 }}>{displayScore}/{sub.max_score}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Score</div>
          </div>
          <div style={{ width: 1, height: 36, background: 'var(--border-light)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: passColor }}>{displayPct}%</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Percentage</div>
          </div>
          <div style={{ width: 1, height: 36, background: 'var(--border-light)' }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 700, color: sub.passed ? 'var(--success-400)' : 'var(--warning-500)' }}>
              {done ? (sub.passed ? 'PASSED' : 'NOT PASSED') : '...'}
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textTransform: 'uppercase' }}>Result</div>
          </div>
        </div>

        {done && sub.teacher_comment && (
          <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontStyle: 'italic', fontSize: '0.88rem' }}>
            &ldquo;{sub.teacher_comment}&rdquo;
          </p>
        )}
        <p style={{ color: 'var(--text-muted)', margin: 0, textAlign: 'center', fontSize: '0.82rem' }}>
          Waiting for others to finish...
        </p>
      </div>
    </div>
  )
}

// ── Quiz Result Reveal (Cinematic overlay) ───────────────────────────────────
function QuizResultReveal({ submission, countdown, onDismiss, quizTitle, teacherName }: {
  submission: QuizSubmission
  countdown: number
  onDismiss: () => void
  quizTitle: string
  teacherName: string
}) {
  const certRef = useRef<HTMLDivElement>(null)
  const showResult = countdown <= 0

  // Animated counters for the certificate score boxes
  const [displayScore, setDisplayScore] = useState(0)
  const [displayPct, setDisplayPct] = useState(0)
  const [displayDone, setDisplayDone] = useState(false)

  useEffect(() => {
    if (!showResult) return
    setDisplayScore(0); setDisplayPct(0); setDisplayDone(false)
    const duration = 2000
    const startTime = performance.now()
    let raf: number
    const tick = (now: number) => {
      const elapsed = Math.min(now - startTime, duration)
      // ease-out cubic
      const t = 1 - Math.pow(1 - elapsed / duration, 3)
      setDisplayScore(Math.round(t * submission.score))
      setDisplayPct(Math.round(t * (submission.percentage ?? 0)))
      if (elapsed < duration) {
        raf = requestAnimationFrame(tick)
      } else {
        setDisplayScore(submission.score)
        setDisplayPct(submission.percentage ?? 0)
        setDisplayDone(true)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [showResult, submission.score, submission.percentage])

  const drawCertificateCanvas = useCallback(() => {
    const W = 900, H = 640
    const canvas = document.createElement('canvas')
    canvas.width = W * 2; canvas.height = H * 2
    const ctx = canvas.getContext('2d')!
    ctx.scale(2, 2)

    // ── Background ──────────────────────────────────────────────
    ctx.fillStyle = '#FEFCF8'
    ctx.fillRect(0, 0, W, H)

    // ── Outer gold border ────────────────────────────────────────
    const mOuter = 18
    ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 3
    ctx.strokeRect(mOuter, mOuter, W - mOuter * 2, H - mOuter * 2)

    // ── Inner thin border ────────────────────────────────────────
    const mInner = 28
    ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 0.8
    ctx.strokeRect(mInner, mInner, W - mInner * 2, H - mInner * 2)

    // ── Corner diamond ornaments ─────────────────────────────────
    const drawDiamond = (cx: number, cy: number) => {
      const s = 7
      ctx.fillStyle = '#C9A84C'
      ctx.beginPath()
      ctx.moveTo(cx, cy - s); ctx.lineTo(cx + s, cy)
      ctx.lineTo(cx, cy + s); ctx.lineTo(cx - s, cy)
      ctx.closePath(); ctx.fill()
    }
    const d = mOuter + 10
    drawDiamond(d, d); drawDiamond(W - d, d)
    drawDiamond(d, H - d); drawDiamond(W - d, H - d)

    // ── Decorative rules flanking the title ──────────────────────
    const ruleY = 78, ruleLen = 220, ruleGap = 18
    ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 1.2
    // left rule
    ctx.beginPath(); ctx.moveTo(W / 2 - ruleGap - ruleLen, ruleY - 4); ctx.lineTo(W / 2 - ruleGap, ruleY - 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W / 2 - ruleGap - ruleLen, ruleY + 1); ctx.lineTo(W / 2 - ruleGap, ruleY + 1); ctx.stroke()
    // right rule
    ctx.beginPath(); ctx.moveTo(W / 2 + ruleGap, ruleY - 4); ctx.lineTo(W / 2 + ruleGap + ruleLen, ruleY - 4); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(W / 2 + ruleGap, ruleY + 1); ctx.lineTo(W / 2 + ruleGap + ruleLen, ruleY + 1); ctx.stroke()

    // ── "CERTIFICATE OF ACHIEVEMENT" ────────────────────────────
    ctx.fillStyle = '#1B2A4A'; ctx.font = '700 13px Georgia, serif'
    ctx.textAlign = 'center'
    ctx.fillText('CERTIFICATE OF ACHIEVEMENT', W / 2, ruleY)

    // ── "This is to certify that" ────────────────────────────────
    ctx.fillStyle = '#6B7280'; ctx.font = 'italic 14px Georgia, serif'
    ctx.fillText('This is to certify that', W / 2, 120)

    // ── Student name ─────────────────────────────────────────────
    ctx.fillStyle = '#B8860B'; ctx.font = 'bold 34px Georgia, serif'
    ctx.fillText(submission.student_name, W / 2, 162)

    // Underline
    const nameWidth = ctx.measureText(submission.student_name).width
    ctx.strokeStyle = '#B8860B'; ctx.lineWidth = 0.8
    ctx.beginPath(); ctx.moveTo(W / 2 - nameWidth / 2 - 12, 170); ctx.lineTo(W / 2 + nameWidth / 2 + 12, 170); ctx.stroke()

    // ── Body text ────────────────────────────────────────────────
    ctx.fillStyle = '#374151'; ctx.font = '14px Georgia, serif'
    ctx.fillText('has successfully completed the examination', W / 2, 198)

    // ── Exam title ───────────────────────────────────────────────
    ctx.fillStyle = '#1B2A4A'; ctx.font = 'bold 20px Georgia, serif'
    ctx.fillText(quizTitle, W / 2, 228)

    // ── Score boxes ──────────────────────────────────────────────
    const boxY = 258, boxH = 72, boxW = 138, gap = 18
    const totalBoxW = boxW * 3 + gap * 2
    const startX = (W - totalBoxW) / 2

    const drawBox = (x: number, topLabel: string, bottomLabel: string, color: string, bgColor: string) => {
      ctx.fillStyle = bgColor
      ctx.beginPath(); ctx.roundRect(x, boxY, boxW, boxH, 6); ctx.fill()
      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.beginPath(); ctx.roundRect(x, boxY, boxW, boxH, 6); ctx.stroke()
      ctx.fillStyle = color; ctx.font = 'bold 22px Georgia, serif'
      ctx.fillText(topLabel, x + boxW / 2, boxY + 34)
      ctx.fillStyle = '#6B7280'; ctx.font = '10px Georgia, serif'
      ctx.fillText(bottomLabel, x + boxW / 2, boxY + 56)
    }

    drawBox(startX, `${submission.score}/${submission.max_score}`, 'SCORE', '#1B2A4A', 'rgba(27,42,74,0.05)')
    const pctX = startX + boxW + gap
    const pctColor = submission.passed ? '#2E7D32' : '#C62828'
    const pctBg = submission.passed ? 'rgba(46,125,50,0.08)' : 'rgba(198,40,40,0.08)'
    drawBox(pctX, `${submission.percentage}%`, 'PERCENTAGE', pctColor, pctBg)
    const resX = pctX + boxW + gap
    drawBox(resX, submission.passed ? 'PASSED' : 'FAILED', 'RESULT', pctColor, pctBg)

    // ── Teacher comment ──────────────────────────────────────────
    let nextY = boxY + boxH + 28
    if (submission.teacher_comment) {
      ctx.fillStyle = '#6B7280'; ctx.font = 'italic 12px Georgia, serif'
      const commentText = `"${submission.teacher_comment}"`
      const maxW = W - 160
      const measured = ctx.measureText(commentText).width
      ctx.fillText(measured > maxW ? commentText.slice(0, 80) + '..."' : commentText, W / 2, nextY)
      nextY += 26
    }

    // ── Footer separator ─────────────────────────────────────────
    const footerLineY = H - 82
    ctx.strokeStyle = '#C9A84C'; ctx.lineWidth = 0.6
    ctx.beginPath(); ctx.moveTo(mInner + 16, footerLineY); ctx.lineTo(W - mInner - 16, footerLineY); ctx.stroke()

    // ── Date string (right) ──────────────────────────────────────
    const dateStr = submission.graded_at
      ? new Date(submission.graded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    ctx.fillStyle = '#6B7280'; ctx.font = '11px Georgia, serif'
    ctx.textAlign = 'right'
    ctx.fillText(dateStr, W - mInner - 22, H - 60)

    // ── Teacher signature (left) ──────────────────────────────────
    ctx.textAlign = 'left'
    ctx.fillStyle = '#1B2A4A'; ctx.font = 'italic bold 13px Georgia, serif'
    ctx.fillText(teacherName, mInner + 22, H - 60)
    ctx.fillStyle = '#6B7280'; ctx.font = '10px Georgia, serif'
    ctx.fillText('Instructor', mInner + 22, H - 44)

    // ── ClassMeet branding (center) ───────────────────────────────
    ctx.textAlign = 'center'
    ctx.fillStyle = '#9CA3AF'; ctx.font = '10px Georgia, serif'
    ctx.fillText('ClassMeet', W / 2, H - 44)

    return canvas
  }, [submission, quizTitle, teacherName])

  const handleDownload = useCallback(() => {
    try {
      const canvas = drawCertificateCanvas()
      const link = document.createElement('a')
      link.download = `certificate-${submission.student_name.replace(/\s+/g, '-')}.png`
      link.href = canvas.toDataURL('image/png')
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Certificate download failed:', err)
    }
  }, [drawCertificateCanvas, submission.student_name])

  return (
    <div className="quiz-reveal-overlay" onClick={onDismiss}>
      <div className="quiz-reveal-container" onClick={e => e.stopPropagation()}>
        {!showResult ? (
          /* Countdown */
          <div className="quiz-reveal-countdown">
            <div className="quiz-reveal-student-name">{submission.student_name}</div>
            <div className="quiz-reveal-countdown-number" key={countdown}>
              {countdown}
            </div>
          </div>
        ) : (
          /* Certificate card */
          <div className="quiz-reveal-result">
            {submission.passed && <div className="quiz-reveal-confetti" />}
            <div className="quiz-reveal-certificate" ref={certRef}>
              {/* Header */}
              <div className="quiz-cert-header">
                <Trophy size={36} className="quiz-cert-trophy" />
                <div className="quiz-cert-header-label">CERTIFICATE OF COMPLETION</div>
                <h2 className="quiz-cert-title">
                  {submission.passed ? 'Congratulations!' : 'Quiz Complete'}
                </h2>
              </div>

              {/* Student */}
              <div className="quiz-cert-subtitle">This certifies that</div>
              <div className="quiz-cert-name">{submission.student_name}</div>
              <div className="quiz-cert-subtitle">has completed the quiz</div>
              <div className="quiz-cert-quiz">{quizTitle}</div>

              {/* Score boxes */}
              <div className="quiz-cert-scores">
                <div className="quiz-cert-score-box">
                  <span className="quiz-cert-score-box-value">{displayScore}/{submission.max_score}</span>
                  <span className="quiz-cert-score-box-label">Score</span>
                </div>
                <div className={`quiz-cert-score-box quiz-cert-score-box-${submission.passed ? 'pass' : 'fail'}`}>
                  <span className="quiz-cert-score-box-value quiz-cert-score-box-pct">{displayPct}%</span>
                  <span className="quiz-cert-score-box-label">Percentage</span>
                </div>
                <div className={`quiz-cert-score-box quiz-cert-score-box-${submission.passed ? 'pass' : 'fail'}`}>
                  <span className="quiz-cert-score-box-value">{displayDone ? (submission.passed ? 'PASSED' : 'NOT PASSED') : '...'}</span>
                  <span className="quiz-cert-score-box-label">Result</span>
                </div>
              </div>

              {/* Comment */}
              {submission.teacher_comment && (
                <div className="quiz-cert-comment">
                  &ldquo;{submission.teacher_comment}&rdquo;
                </div>
              )}

              {/* Date */}
              <div className="quiz-cert-date">
                {submission.graded_at
                  ? new Date(submission.graded_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
                  : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
              </div>

              {/* Footer */}
              <div className="quiz-cert-footer">ClassMeet</div>
            </div>

            <div className="quiz-reveal-actions">
              <button className="btn btn-primary btn-sm" onClick={handleDownload}>
                <Download size={14} /> Download Certificate
              </button>
              <button className="btn btn-outline btn-sm" onClick={onDismiss}>
                Close
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Chat Panel ───────────────────────────────────────────────────────────────
type ChatTab = 'chat' | 'play' | 'slides'

interface ChatPanelProps {
  onClose: () => void
  isMobile?: boolean
  isHost: boolean
  blackboardRef: React.RefObject<BlackboardHandle | null>
  onBlackboardEvent: (event: BlackboardEvent) => void
  blackboardActive: boolean
  onActivateBlackboard: () => void
}

// Compress an image file client-side to a max dimension & quality
async function compressImage(file: File, maxDim = 1280, quality = 0.7): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    img.onload = () => {
      let w = img.width, h = img.height
      if (w > maxDim || h > maxDim) {
        const ratio = Math.min(maxDim / w, maxDim / h)
        w = Math.round(w * ratio)
        h = Math.round(h * ratio)
      }
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, w, h)
      resolve(canvas.toDataURL('image/jpeg', quality))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => { URL.revokeObjectURL(img.src); reject(new Error('Failed to load image')) }
    img.src = URL.createObjectURL(file)
  })
}

function ChatPanel({ onClose, isMobile, isHost, blackboardRef, onBlackboardEvent, blackboardActive, onActivateBlackboard }: ChatPanelProps) {
  const { chatMessages, send, isSending } = useChat()
  const [message, setMessage] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<ChatTab>('chat')

  // ── Play state ──
  const [playText, setPlayText] = useState('')
  const [wordsPerBurst, setWordsPerBurst] = useState(1)
  const [sentenceInterval, setSentenceInterval] = useState(1)
  const [isPlaying, setIsPlaying] = useState(false)
  const [playPosition, setPlayPosition] = useState<{ x: number; y: number } | null>(null)
  const [playStep, setPlayStep] = useState(0)
  const [playTotal, setPlayTotal] = useState(0)
  const flyQueueRef = useRef<({ word: string; targetX: number; targetY: number }[] | null)[]>([])
  const playIndexRef = useRef(0)

  // ── Slides state ──
  const [slides, setSlides] = useState<string[]>([])
  const [currentSlide, setCurrentSlide] = useState(0)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current && activeTab === 'chat') {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages.length, activeTab])

  // Reset play state on unmount
  useEffect(() => {
    return () => { flyQueueRef.current = []; playIndexRef.current = 0 }
  }, [])

  const handleSend = useCallback(async () => {
    if (!message.trim() || isSending) return
    await send(message.trim())
    setMessage('')
  }, [message, isSending, send])

  // ── Play: split text into sentences → words ──
  const parsePlayText = useCallback(() => {
    // Split by newlines, periods, exclamation marks, or question marks
    const sentences = playText.split(/[\n\r]+|[.!?]+/).map(s => s.trim()).filter(Boolean)
    return sentences.map(s => s.split(/\s+/).filter(Boolean))
  }, [playText])

  // ── Play: start flying words ──
  const startPlaying = useCallback(() => {
    const sentences = parsePlayText()
    if (sentences.length === 0) return
    if (!blackboardActive) onActivateBlackboard()

    // Clear board before starting play (same as slides behavior)
    onBlackboardEvent({ type: 'clear' })
    blackboardRef.current?.applyLiveEvent({ type: 'clear' })

    setIsPlaying(true)
    playIndexRef.current = 0

    const startX = playPosition?.x ?? 40
    const startY = playPosition?.y ?? 30
    const LOGICAL_W = 1280
    const LOGICAL_H = 720
    const LINE_HEIGHT = 50
    const FONT_SIZE = 28
    const SPACE_WIDTH = FONT_SIZE * 0.35  // Approximate space character width
    const FABRIC_PADDING = 6              // Fabric IText internal padding compensation
    const linesAtOnce = sentenceInterval  // How many lines to play simultaneously

    // Measure actual word widths using the same font as the board
    const measureCanvas = document.createElement('canvas')
    const measureCtx = measureCanvas.getContext('2d')!
    measureCtx.font = `${FONT_SIZE}px Arial, sans-serif`

    // Pre-build all fly batches
    // Each batch = array of words to fly simultaneously in one tick
    // null entries mark group boundaries (board clears between groups)
    type FlyItem = { word: string; targetX: number; targetY: number }
    const flyQueue: (FlyItem[] | null)[] = []

    // Process sentences in groups of linesAtOnce
    for (let groupStart = 0; groupStart < sentences.length; groupStart += linesAtOnce) {
      // Insert a group-boundary sentinel between groups (not before the first)
      if (groupStart > 0) flyQueue.push(null)

      const groupEnd = Math.min(groupStart + linesAtOnce, sentences.length)
      const groupLines: string[][] = []
      for (let i = groupStart; i < groupEnd; i++) groupLines.push(sentences[i])

      // Per-line state: x position and word index
      // Y is relative within the group (each group starts fresh from startY)
      const lineState = groupLines.map((_, li) => ({
        x: startX,
        y: Math.min(startY + li * LINE_HEIGHT, LOGICAL_H - 60),
        wordIdx: 0,
      }))

      // Build batches: each step picks wordsPerBurst words from EVERY active line
      // so total batch size = wordsPerBurst × number of lines with remaining words
      let anyLeft = true
      while (anyLeft) {
        const batch: FlyItem[] = []

        for (let li = 0; li < groupLines.length; li++) {
          const words = groupLines[li]
          const state = lineState[li]
          for (let w = 0; w < wordsPerBurst && state.wordIdx < words.length; w++) {
            const word = words[state.wordIdx]
            batch.push({ word, targetX: state.x, targetY: state.y })
            // Add measured word width + space gap + Fabric padding correction
            state.x += measureCtx.measureText(word).width + SPACE_WIDTH + FABRIC_PADDING
            if (state.x > LOGICAL_W - 100) {
              state.x = startX
              state.y += LINE_HEIGHT
              // Cap at bottom — don't wrap back to top (prevents overlapping)
              if (state.y > LOGICAL_H - 60) state.y = LOGICAL_H - 60
            }
            state.wordIdx++
          }
        }

        if (batch.length === 0) {
          anyLeft = false
        } else {
          flyQueue.push(batch)
        }
      }
    }

    flyQueueRef.current = flyQueue
    playIndexRef.current = 0
    // Count only real batches (exclude null sentinels) for the step counter
    setPlayTotal(flyQueue.filter(b => b !== null).length)

    // Fly the first batch immediately (first entry is never a sentinel)
    if (flyQueue.length > 0 && flyQueue[0] !== null) {
      const batch = flyQueue[0]
      for (const item of batch) {
        const id = `fly_${Date.now()}_0_${Math.random().toString(36).slice(2, 6)}`
        const flyEvent = { type: 'fly-word' as const, text: item.word, targetX: item.targetX, targetY: item.targetY, id, fontSize: 28, fill: '#ffffff' }
        onBlackboardEvent(flyEvent)
        blackboardRef.current?.applyLiveEvent(flyEvent)
      }
      playIndexRef.current = 1
      setPlayStep(1)
    }
  }, [parsePlayText, blackboardActive, onActivateBlackboard, onBlackboardEvent, blackboardRef, playPosition, wordsPerBurst, sentenceInterval])

  // Fly the next batch on manual click
  const nextPlayStep = useCallback(() => {
    const queue = flyQueueRef.current
    let idx = playIndexRef.current
    if (idx >= queue.length) {
      setIsPlaying(false)
      flyQueueRef.current = []
      playIndexRef.current = 0
      return
    }

    // If we hit a group-boundary sentinel, clear the board and advance past it
    if (queue[idx] === null) {
      onBlackboardEvent({ type: 'clear' })
      blackboardRef.current?.applyLiveEvent({ type: 'clear' })
      idx += 1
      playIndexRef.current = idx
      if (idx >= queue.length) {
        setIsPlaying(false)
        flyQueueRef.current = []
        playIndexRef.current = 0
        return
      }
    }

    const batch = queue[idx]!
    for (const item of batch) {
      const id = `fly_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`
      const flyEvent = { type: 'fly-word' as const, text: item.word, targetX: item.targetX, targetY: item.targetY, id, fontSize: 28, fill: '#ffffff' }
      onBlackboardEvent(flyEvent)
      blackboardRef.current?.applyLiveEvent(flyEvent)
    }
    playIndexRef.current = idx + 1
    // Step counter counts only real batches
    setPlayStep(prev => prev + 1)
    // Auto-finish if that was the last batch
    if (idx + 1 >= queue.length) {
      setIsPlaying(false)
      flyQueueRef.current = []
      playIndexRef.current = 0
    }
  }, [onBlackboardEvent, blackboardRef])

  const stopPlaying = useCallback(() => {
    setIsPlaying(false)
    flyQueueRef.current = []
    playIndexRef.current = 0
  }, [])

  // Play: click on blackboard to set starting position
  useEffect(() => {
    if (activeTab !== 'play') return
    const handler = (e: MouseEvent) => {
      const canvas = document.querySelector('.room-blackboard canvas') as HTMLCanvasElement
      if (!canvas || !canvas.contains(e.target as Node)) return
      const rect = canvas.getBoundingClientRect()
      const zoom = canvas.width / 1280
      const lx = (e.clientX - rect.left) / zoom
      const ly = (e.clientY - rect.top) / zoom
      setPlayPosition({ x: Math.round(lx), y: Math.round(ly) })
    }
    document.addEventListener('click', handler)
    return () => document.removeEventListener('click', handler)
  }, [activeTab])

  // ── Slides: upload & compress ──
  const handleSlideUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files || files.length === 0) return
    setIsUploading(true)
    try {
      const compressed: string[] = []
      for (const file of Array.from(files)) {
        if (!file.type.startsWith('image/')) continue
        const dataUrl = await compressImage(file, 1280, 0.7)
        compressed.push(dataUrl)
      }
      setSlides(prev => [...prev, ...compressed])
      if (slides.length === 0 && compressed.length > 0) setCurrentSlide(0)
    } finally {
      setIsUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }, [slides.length])

  const removeSlide = useCallback((idx: number) => {
    setSlides(prev => {
      const next = prev.filter((_, i) => i !== idx)
      if (currentSlide >= next.length) setCurrentSlide(Math.max(0, next.length - 1))
      return next
    })
  }, [currentSlide])

  // Slides: present on blackboard as image
  const presentSlide = useCallback((idx: number) => {
    if (!slides[idx]) return
    if (!blackboardActive) onActivateBlackboard()
    setCurrentSlide(idx)

    const id = `slide_${Date.now()}_${idx}`
    // Clear board then add image
    onBlackboardEvent({ type: 'clear' })
    blackboardRef.current?.applyLiveEvent({ type: 'clear' })

    const imgObj = {
      type: 'Image',
      version: '6.6.1',
      left: 0,
      top: 0,
      width: 1280,
      height: 720,
      scaleX: 1,
      scaleY: 1,
      src: slides[idx],
      id,
      selectable: false,
      evented: false,
      crossOrigin: 'anonymous',
    }
    onBlackboardEvent({ type: 'object-added', data: JSON.stringify(imgObj), id })
    blackboardRef.current?.applyLiveEvent({ type: 'object-added', data: JSON.stringify(imgObj), id })
  }, [slides, blackboardActive, onActivateBlackboard, onBlackboardEvent, blackboardRef])

  const tabs: { key: ChatTab; label: string; icon: React.ReactNode }[] = [
    { key: 'chat', label: 'Chat', icon: <MessageSquare size={14} /> },
    ...(isHost ? [
      { key: 'play' as ChatTab, label: 'Play', icon: <Play size={14} /> },
      { key: 'slides' as ChatTab, label: 'Slides', icon: <Image size={14} /> },
    ] : []),
  ]

  return (
    <div className={`room-sidebar room-sidebar-right ${isMobile ? 'room-sidebar-mobile' : ''}`}>
      {isMobile && <div className="room-mobile-overlay-bg" onClick={onClose} />}
      <div className="room-sidebar-header">
        <div className="room-chat-tabs">
          {tabs.map(t => (
            <button
              key={t.key}
              className={`room-chat-tab ${activeTab === t.key ? 'room-chat-tab-active' : ''}`}
              onClick={() => setActiveTab(t.key)}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <button className="room-icon-btn room-icon-btn-sm" onClick={onClose} title="Hide panel">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* ── Chat Tab ── */}
      {activeTab === 'chat' && (
        <>
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
        </>
      )}

      {/* ── Play Tab ── */}
      {activeTab === 'play' && (
        <div className="room-sidebar-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Type or paste text. Words will fly onto the board.
            {playPosition ? (
              <span style={{ color: 'var(--primary-400)' }}> • Starting at ({playPosition.x}, {playPosition.y})</span>
            ) : ' Click on the board to set starting position.'}
          </div>

          <textarea
            className="input"
            style={{ minHeight: 120, resize: 'vertical', fontSize: '0.85rem', fontFamily: 'inherit', lineHeight: 1.5 }}
            placeholder="Paste or type your paragraph here…"
            value={playText}
            onChange={e => setPlayText(e.target.value)}
            disabled={isPlaying}
          />

          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 100 }}>
              Words per burst
              <input
                type="number"
                className="input"
                style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                value={wordsPerBurst}
                min={1}
                max={20}
                onChange={e => setWordsPerBurst(Math.max(1, Math.min(20, Number(e.target.value) || 1)))}
                disabled={isPlaying}
              />
            </label>
            <label style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 100 }}>
              Every N sentences
              <input
                type="number"
                className="input"
                style={{ fontSize: '0.82rem', padding: '4px 8px' }}
                value={sentenceInterval}
                min={1}
                max={10}
                onChange={e => setSentenceInterval(Math.max(1, Math.min(10, Number(e.target.value) || 1)))}
                disabled={isPlaying}
              />
            </label>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            {!isPlaying ? (
              <button
                className="btn btn-primary"
                style={{ flex: 1, fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                onClick={startPlaying}
                disabled={!playText.trim()}
              >
                <Play size={14} /> Start
              </button>
            ) : (
              <>
                <button
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={nextPlayStep}
                >
                  <SkipForward size={14} /> Next
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
                  onClick={stopPlaying}
                >
                  <X size={14} /> Stop
                </button>
              </>
            )}
          </div>

          {isPlaying && (
            <div style={{ fontSize: '0.75rem', color: 'var(--primary-400)', textAlign: 'center' }}>
              Step {playStep} / {playTotal} — Click Next to fly the next word(s)
            </div>
          )}
        </div>
      )}

      {/* ── Slides Tab ── */}
      {activeTab === 'slides' && (
        <div className="room-sidebar-body" style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Upload images to present as slides. They are temporary and won&apos;t be stored.
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            style={{ display: 'none' }}
            onChange={handleSlideUpload}
          />
          <button
            className="btn btn-outline"
            style={{ fontSize: '0.82rem', padding: '8px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload size={14} /> {isUploading ? 'Compressing…' : 'Upload Images'}
          </button>

          {slides.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(80px, 1fr))', gap: 6 }}>
                {slides.map((src, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'relative', borderRadius: 6, overflow: 'hidden',
                      border: currentSlide === i ? '2px solid var(--primary-500)' : '2px solid #3f3f46',
                      cursor: 'pointer', aspectRatio: '16/9',
                    }}
                    onClick={() => presentSlide(i)}
                  >
                    <img src={src} alt={`Slide ${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <button
                      style={{
                        position: 'absolute', top: 2, right: 2,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(0,0,0,0.7)', border: 'none',
                        color: '#f87171', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      onClick={e => { e.stopPropagation(); removeSlide(i) }}
                      title="Remove slide"
                    >
                      <X size={10} />
                    </button>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      background: 'rgba(0,0,0,0.6)', padding: '1px 4px',
                      fontSize: '0.6rem', color: '#e4e4e7', textAlign: 'center',
                    }}>
                      {i + 1}
                    </div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                <button
                  className="room-icon-btn"
                  onClick={() => { if (currentSlide > 0) presentSlide(currentSlide - 1) }}
                  disabled={currentSlide <= 0}
                  title="Previous slide"
                >
                  <ArrowLeft size={16} />
                </button>
                <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                  {slides.length > 0 ? `${currentSlide + 1} / ${slides.length}` : 'No slides'}
                </span>
                <button
                  className="room-icon-btn"
                  onClick={() => { if (currentSlide < slides.length - 1) presentSlide(currentSlide + 1) }}
                  disabled={currentSlide >= slides.length - 1}
                  title="Next slide"
                >
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}
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
  isCameraLayerActive: boolean
  onToggleCameraLayer: () => void
  allowStudentDrawing?: boolean
  onToggleAllowStudentDrawing?: () => void
}

function ControlBarCustom({
  isMicEnabled, isCamEnabled, isScreenShareEnabled, isHandRaised,
  isTeacher, localParticipant, onToggleHand, onLowerAllHands, onSettings, onLeave, raisedHandCount, isMobile,
  isBlackboardActive, isCourseActive, isQuizActive, activeCourseId, activeQuizId,
  onToggleBlackboard, linkedCourses, linkedQuizzes,
  onToggleCourse, onToggleQuiz, onSelectCourse, onSelectQuiz, isCameraLayerActive, onToggleCameraLayer,
  allowStudentDrawing = false, onToggleAllowStudentDrawing,
}: ControlBarProps) {
  const [showCourseMenu, setShowCourseMenu] = useState(false)
  const [showQuizMenu, setShowQuizMenu] = useState(false)
  const [quizMenuReady, setQuizMenuReady] = useState(false)
  const courseMenuRef = useRef<HTMLDivElement>(null)
  const quizMenuRef = useRef<HTMLDivElement>(null)
  const quizMenuTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (showQuizMenu) {
      setQuizMenuReady(false)
      quizMenuTimerRef.current = setTimeout(() => setQuizMenuReady(true), 600)
    } else {
      if (quizMenuTimerRef.current) clearTimeout(quizMenuTimerRef.current)
      setQuizMenuReady(false)
    }
    return () => { if (quizMenuTimerRef.current) clearTimeout(quizMenuTimerRef.current) }
  }, [showQuizMenu])

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

      // Use e.code (physical key) — reliable across all keyboard layouts
      const code = e.code
      if (code === 'KeyB') {
        e.preventDefault()
        onToggleBlackboard()
        return
      }

      if (code === 'KeyC') {
        e.preventDefault()
        if (isCourseActive || activeCourseId) {
          onToggleCourse()
        } else {
          setShowCourseMenu(true)
          setShowQuizMenu(false)
        }
        return
      }

      if (code === 'KeyE') {
        e.preventDefault()
        if (isQuizActive || activeQuizId) {
          onToggleQuiz()
        } else {
          setShowQuizMenu(true)
          setShowCourseMenu(false)
        }
        return
      }

      if (code === 'KeyH') {
        e.preventDefault()
        onToggleCameraLayer()
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
    onToggleCameraLayer,
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
                title={isQuizActive ? 'Hide exam (Ctrl+E)' : 'Show exam (Ctrl+E)'}
              >
                <HelpCircle size={20} />
                <span className="room-control-label">Exam</span>
              </button>

              {showQuizMenu && (
                <div className="room-present-menu">
                  <div className="room-present-menu-label">Choose Exam</div>
                  {!quizMenuReady ? (
                    <div className="room-present-menu-empty" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ animation: 'spin 1s linear infinite' }}>
                        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                      </svg>
                      Searching exams...
                    </div>
                  ) : (
                    <>
                      {linkedQuizzes.map(q => (
                        <div key={q.id} className="room-present-menu-item" onClick={() => handleQuizPick(q.id)}>
                          <HelpCircle size={16} />
                          <span>{q.title}</span>
                        </div>
                      ))}
                      {linkedQuizzes.length === 0 && (
                        <div className="room-present-menu-empty">No exams linked to this session</div>
                      )}
                    </>
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
              <span className="room-control-label">Board</span>
            </button>

            {isBlackboardActive && (
              <button
                className={`room-control-btn ${allowStudentDrawing ? 'room-control-btn-active' : ''}`}
                onClick={onToggleAllowStudentDrawing}
                title={allowStudentDrawing ? 'Disable student drawing' : 'Allow student drawing'}
              >
                <Pencil size={20} />
                <span className="room-control-label">{allowStudentDrawing ? 'Drawing ON' : 'Drawing OFF'}</span>
              </button>
            )}

            <button
              className={`room-control-btn ${isCameraLayerActive ? 'room-control-btn-active' : ''}`}
              onClick={onToggleCameraLayer}
              title={isCameraLayerActive ? 'Send camera to back (Ctrl+H)' : 'Bring camera to front (Ctrl+H)'}
            >
              <Video size={20} />
              <span className="room-control-label">Host</span>
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