export type UserRole = 'super_admin' | 'admin' | 'member' | 'teacher' | 'student' | 'guest'

export type TeacherType = 'independent' | 'school_employed' | 'collaborator'

export type TeacherPermissionKey =
  | 'invite_members'
  | 'create_groups'
  | 'create_courses'
  | 'create_sessions'
  | 'manage_quizzes'
  | 'manage_settings'

export type School = {
  id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  admin_id: string
  default_teacher_password: string
  default_student_password: string
  created_at: string
  updated_at: string
}

export type Class = {
  id: string
  school_id: string
  name: string
  description: string | null
  teacher_id: string | null
  created_at: string
  updated_at: string
}

export type ClassMember = {
  id: string
  class_id: string
  student_id: string
  added_at: string
}

export type Profile = {
  id: string
  full_name: string | null
  avatar_url: string | null
  role: UserRole | null
  goals: string[]
  subjects: string[]
  onboarding_complete: boolean
  referred_by: string | null
  last_seen: string | null
  school_id: string | null
  teacher_type: TeacherType | null
  invited_by: string | null
  created_at: string
  updated_at: string
}

export type Referral = {
  id: string
  referrer_id: string
  referred_id: string
  created_at: string
}

export type Course = {
  id: string
  teacher_id: string
  title: string
  description: string
  subject: string
  level: string
  published: boolean
  school_id: string | null
  created_at: string
  updated_at: string
}

export type Topic = {
  id: string
  course_id: string
  title: string
  sort_order: number
  created_at: string
}

export type Lesson = {
  id: string
  topic_id: string
  title: string
  type: 'text' | 'video' | 'quiz'
  content: string
  video_url: string | null
  sort_order: number
  created_at: string
}

export type TeacherStudent = {
  id: string
  teacher_id: string
  student_id: string
  status: 'active' | 'inactive' | 'pending'
  enrolled_at: string
  school_id: string | null
  created_at: string
}

export type Group = {
  id: string
  teacher_id: string
  name: string
  description: string | null
  school_id: string | null
  created_at: string
  updated_at: string
}

export type GroupMember = {
  id: string
  group_id: string
  student_id: string
  added_at: string
}

export type Session = {
  id: string
  teacher_id: string
  title: string
  description: string | null
  status: 'live' | 'scheduled' | 'ended'
  max_participants: number
  scheduled_at: string | null
  started_at: string | null
  ended_at: string | null
  room_name: string
  school_id: string | null
  created_at: string
  updated_at: string
}

export type SessionTarget = {
  id: string
  session_id: string
  target_type: 'group' | 'student'
  target_id: string
  created_at: string
}

export type CourseTarget = {
  id: string
  course_id: string
  target_type: 'group' | 'student'
  target_id: string
  created_at: string
}

export type Quiz = {
  id: string
  teacher_id: string
  title: string
  description: string | null
  pass_threshold: number
  reveal_delay_days: number | null
  exam_start_date: string | null
  school_id: string | null
  created_at: string
  updated_at: string
}

export type QuizQuestion = {
  id: string
  quiz_id: string
  question_text: string
  question_type: 'multiple_choice' | 'true_false' | 'short_answer' | 'fill_blank'
  options: string[]
  correct_index: number
  correct_answer: string | null
  sort_order: number
  time_limit: number
  points: number
  created_at: string
}

export type SessionQuiz = {
  id: string
  session_id: string
  quiz_id: string
}

export type SessionCourse = {
  id: string
  session_id: string
  course_id: string
}

export type QuizTarget = {
  id: string
  quiz_id: string
  target_type: 'group' | 'student'
  target_id: string
  created_at: string
}

export type QuizSubmission = {
  id: string
  quiz_id: string
  session_id: string
  student_id: string
  student_name: string
  started_at: string
  submitted_at: string | null
  status: 'in_progress' | 'submitted' | 'graded' | 'revealed'
  score: number
  max_score: number
  percentage: number
  passed: boolean
  teacher_comment: string | null
  graded_by: string | null
  graded_at: string | null
  created_at: string
}

export type QuizResponse = {
  id: string
  submission_id: string
  question_id: string
  answer_index: number | null
  answer_text: string | null
  is_correct: boolean | null
  score: number | null
  teacher_comment: string | null
  sort_order: number
  created_at: string
}

export type Conversation = {
  id: string
  type: 'direct' | 'group'
  name: string | null
  created_by: string | null
  school_id: string | null
  created_at: string
  updated_at: string
}

export type ConversationParticipant = {
  id: string
  conversation_id: string
  user_id: string
  joined_at: string
  last_read_at: string
}

export type Message = {
  id: string
  conversation_id: string
  sender_id: string
  content: string
  created_at: string
  updated_at: string
}

export type SuperAdminAuditLog = {
  id: string
  super_admin_id: string
  action: string
  target_type: string | null
  target_id: string | null
  details: any | null
  created_at: string
}

export type SystemSettings = {
  id: string
  setting_key: string
  setting_value: any
  description: string | null
  updated_by: string | null
  updated_at: string
}

export type TeacherWorkspace = {
  id: string
  teacher_id: string
  name: string
  slug: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  welcome_message: string | null
  email_template_name: string | null
  created_at: string
  updated_at: string
}

export type TeacherPermission = {
  id: string
  teacher_id: string
  granted_by: string
  permission: TeacherPermissionKey
  created_at: string
}

export type Database = {
  public: {
    Tables: {
      schools: {
        Row: School
        Insert: Omit<School, 'id' | 'created_at' | 'updated_at' | 'logo_url' | 'primary_color' | 'secondary_color' | 'default_teacher_password' | 'default_student_password'> & {
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          default_teacher_password?: string
          default_student_password?: string
        }
        Update: Partial<Omit<School, 'id' | 'created_at'>>
        Relationships: []
      }
      classes: {
        Row: Class
        Insert: Omit<Class, 'id' | 'created_at' | 'updated_at' | 'teacher_id' | 'description'> & { teacher_id?: string | null; description?: string | null }
        Update: Partial<Omit<Class, 'id' | 'created_at'>>
        Relationships: []
      }
      class_members: {
        Row: ClassMember
        Insert: Omit<ClassMember, 'id' | 'added_at'>
        Update: Partial<Omit<ClassMember, 'id' | 'added_at'>>
        Relationships: []
      }
      profiles: {
        Row: Profile
        Insert: Partial<Profile> & { id: string }
        Update: Partial<Omit<Profile, 'id' | 'created_at'>>
        Relationships: []
      }
      referrals: {
        Row: Referral
        Insert: Omit<Referral, 'id' | 'created_at'>
        Update: Partial<Omit<Referral, 'id' | 'created_at'>>
        Relationships: []
      }
      courses: {
        Row: Course
        Insert: Omit<Course, 'id' | 'created_at' | 'updated_at' | 'published' | 'school_id'> & { school_id?: string | null }
        Update: Partial<Omit<Course, 'id' | 'created_at'>>
        Relationships: []
      }
      topics: {
        Row: Topic
        Insert: Omit<Topic, 'id' | 'created_at'>
        Update: Partial<Omit<Topic, 'id' | 'created_at'>>
        Relationships: []
      }
      lessons: {
        Row: Lesson
        Insert: Omit<Lesson, 'id' | 'created_at'>
        Update: Partial<Omit<Lesson, 'id' | 'created_at'>>
        Relationships: []
      }
      teacher_students: {
        Row: TeacherStudent
        Insert: Omit<TeacherStudent, 'id' | 'created_at' | 'enrolled_at' | 'status' | 'school_id'> & { school_id?: string | null }
        Update: Partial<Omit<TeacherStudent, 'id' | 'created_at'>>
        Relationships: []
      }
      groups: {
        Row: Group
        Insert: Omit<Group, 'id' | 'created_at' | 'updated_at' | 'school_id'> & { school_id?: string | null }
        Update: Partial<Omit<Group, 'id' | 'created_at'>>
        Relationships: []
      }
      group_members: {
        Row: GroupMember
        Insert: Omit<GroupMember, 'id' | 'added_at'>
        Update: Partial<Omit<GroupMember, 'id' | 'added_at'>>
        Relationships: []
      }
      sessions: {
        Row: Session
        Insert: Omit<Session, 'id' | 'created_at' | 'updated_at' | 'started_at' | 'ended_at' | 'school_id'> & { started_at?: string | null; ended_at?: string | null; school_id?: string | null }
        Update: Partial<Omit<Session, 'id' | 'created_at'>>
        Relationships: []
      }
      session_targets: {
        Row: SessionTarget
        Insert: Omit<SessionTarget, 'id' | 'created_at'>
        Update: Partial<Omit<SessionTarget, 'id' | 'created_at'>>
        Relationships: []
      }
      course_targets: {
        Row: CourseTarget
        Insert: Omit<CourseTarget, 'id' | 'created_at'>
        Update: Partial<Omit<CourseTarget, 'id' | 'created_at'>>
        Relationships: []
      }
      quizzes: {
        Row: Quiz
        Insert: Omit<Quiz, 'id' | 'created_at' | 'updated_at' | 'pass_threshold' | 'reveal_delay_days' | 'exam_start_date' | 'school_id'> & { pass_threshold?: number; reveal_delay_days?: number | null; exam_start_date?: string | null; school_id?: string | null }
        Update: Partial<Omit<Quiz, 'id' | 'created_at'>>
        Relationships: []
      }
      quiz_questions: {
        Row: QuizQuestion
        Insert: Omit<QuizQuestion, 'id' | 'created_at'>
        Update: Partial<Omit<QuizQuestion, 'id' | 'created_at'>>
        Relationships: []
      }
      session_quizzes: {
        Row: SessionQuiz
        Insert: Omit<SessionQuiz, 'id'>
        Update: Partial<Omit<SessionQuiz, 'id'>>
        Relationships: []
      }
      session_courses: {
        Row: SessionCourse
        Insert: Omit<SessionCourse, 'id'>
        Update: Partial<Omit<SessionCourse, 'id'>>
        Relationships: []
      }
      quiz_targets: {
        Row: QuizTarget
        Insert: Omit<QuizTarget, 'id' | 'created_at'>
        Update: Partial<Omit<QuizTarget, 'id' | 'created_at'>>
        Relationships: []
      }
      quiz_submissions: {
        Row: QuizSubmission
        Insert: Omit<QuizSubmission, 'id' | 'created_at' | 'started_at' | 'submitted_at' | 'score' | 'max_score' | 'percentage' | 'passed' | 'graded_at'>
        Update: Partial<Omit<QuizSubmission, 'id' | 'created_at'>>
        Relationships: []
      }
      quiz_responses: {
        Row: QuizResponse
        Insert: Omit<QuizResponse, 'id' | 'created_at'>
        Update: Partial<Omit<QuizResponse, 'id' | 'created_at'>>
        Relationships: []
      }
      conversations: {
        Row: Conversation
        Insert: Omit<Conversation, 'id' | 'created_at' | 'updated_at' | 'school_id'> & { school_id?: string | null }
        Update: Partial<Omit<Conversation, 'id' | 'created_at'>>
        Relationships: []
      }
      conversation_participants: {
        Row: ConversationParticipant
        Insert: Omit<ConversationParticipant, 'id' | 'joined_at' | 'last_read_at'>
        Update: Partial<Omit<ConversationParticipant, 'id' | 'joined_at'>>
        Relationships: []
      }
      messages: {
        Row: Message
        Insert: Omit<Message, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<Message, 'id' | 'created_at'>>
        Relationships: []
      }
      teacher_workspaces: {
        Row: TeacherWorkspace
        Insert: Omit<TeacherWorkspace, 'id' | 'created_at' | 'updated_at' | 'logo_url' | 'primary_color' | 'secondary_color' | 'welcome_message' | 'email_template_name'> & {
          logo_url?: string | null
          primary_color?: string
          secondary_color?: string
          welcome_message?: string | null
          email_template_name?: string | null
        }
        Update: Partial<Omit<TeacherWorkspace, 'id' | 'created_at'>>
        Relationships: []
      }
      teacher_permissions: {
        Row: TeacherPermission
        Insert: Omit<TeacherPermission, 'id' | 'created_at'>
        Update: Partial<Omit<TeacherPermission, 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<never, never>
    Functions: {
      get_invite_profile: {
        Args: { teacher_id: string }
        Returns: { id: string; full_name: string | null; avatar_url: string | null; subjects: string[] | null }[]
      }
      is_group_owner: {
        Args: { gid: string }
        Returns: boolean
      }
      is_session_owner: {
        Args: { sid: string }
        Returns: boolean
      }
      get_user_school_id: {
        Args: Record<string, never>
        Returns: string | null
      }
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<never, never>
  }
}

