import { create } from 'zustand'

export interface ChatMessage {
  id: string
  userId: string
  userName: string
  avatarUrl: string | null
  text: string
  timestamp: number
}

export interface Participant {
  id: string
  name: string
  avatarUrl: string | null
  isSpeaking: boolean
  isMuted: boolean
  isCameraOff: boolean
  isHandRaised: boolean
  role: 'teacher' | 'student' | 'guest'
}

export interface QuizQuestion {
  id: string
  text: string
  options: string[]
  correctIndex: number
}

export interface QuizState {
  active: boolean
  question: QuizQuestion | null
  answers: Record<string, number>
  timeLeft: number
  revealed: boolean
}

export interface CourseSlide {
  id: string
  title: string
  content: string
  imageUrl?: string
}

interface RoomState {
  // Session
  roomId: string | null
  setRoomId: (id: string | null) => void

  // Participants
  participants: Participant[]
  setParticipants: (p: Participant[]) => void
  updateParticipant: (id: string, updates: Partial<Participant>) => void

  // Spotlight
  spotlightId: string | null
  setSpotlight: (id: string | null) => void

  // Chat
  messages: ChatMessage[]
  addMessage: (msg: ChatMessage) => void
  clearMessages: () => void

  // Quiz
  quiz: QuizState
  setQuiz: (quiz: Partial<QuizState>) => void
  resetQuiz: () => void

  // Slideshow
  slides: CourseSlide[]
  currentSlide: number
  setSlides: (slides: CourseSlide[]) => void
  setCurrentSlide: (index: number) => void

  // Teacher presence
  teacherPresent: boolean
  setTeacherPresent: (present: boolean) => void

  // Grace period
  gracePeriodSeconds: number
  setGracePeriod: (seconds: number) => void

  // Reset
  resetRoom: () => void
}

const defaultQuiz: QuizState = {
  active: false,
  question: null,
  answers: {},
  timeLeft: 0,
  revealed: false,
}

export const useRoomStore = create<RoomState>()((set) => ({
  roomId: null,
  setRoomId: (roomId) => set({ roomId }),

  participants: [],
  setParticipants: (participants) => set({ participants }),
  updateParticipant: (id, updates) =>
    set((s) => ({
      participants: s.participants.map((p) =>
        p.id === id ? { ...p, ...updates } : p
      ),
    })),

  spotlightId: null,
  setSpotlight: (spotlightId) => set({ spotlightId }),

  messages: [],
  addMessage: (msg) =>
    set((s) => ({ messages: [...s.messages.slice(-199), msg] })),
  clearMessages: () => set({ messages: [] }),

  quiz: defaultQuiz,
  setQuiz: (update) => set((s) => ({ quiz: { ...s.quiz, ...update } })),
  resetQuiz: () => set({ quiz: defaultQuiz }),

  slides: [],
  currentSlide: 0,
  setSlides: (slides) => set({ slides }),
  setCurrentSlide: (currentSlide) => set({ currentSlide }),

  teacherPresent: false,
  setTeacherPresent: (teacherPresent) => set({ teacherPresent }),

  gracePeriodSeconds: 0,
  setGracePeriod: (gracePeriodSeconds) => set({ gracePeriodSeconds }),

  resetRoom: () =>
    set({
      roomId: null,
      participants: [],
      spotlightId: null,
      messages: [],
      quiz: defaultQuiz,
      slides: [],
      currentSlide: 0,
      teacherPresent: false,
      gracePeriodSeconds: 0,
    }),
}))

