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
  MonitorOff, Volume2, PenTool,
} from 'lucide-react'
import Blackboard, { type BlackboardEvent, type BlackboardHandle } from '@/components/room/Blackboard'

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
const encoder = new TextEncoder()
const decoder = new TextDecoder()

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
  // Panel visibility (desktop: default open, mobile: default closed)
  const [showParticipants, setShowParticipants] = useState(false)
  const [showChat, setShowChat] = useState(false)
  // Settings modal
  const [showSettings, setShowSettings] = useState(false)
  // Blackboard
  const [blackboardActive, setBlackboardActive] = useState(false)
  const [blackboardEvent, setBlackboardEvent] = useState<BlackboardEvent | null>(null)
  const blackboardRef = useRef<BlackboardHandle>(null)
  const prevParticipantCount = useRef(0)
  // Mobile detection – null means "not yet determined"
  const [isMobile, setIsMobile] = useState<boolean | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Default desktop panels open – only after first mobile check
  useEffect(() => {
    if (isMobile === false) {
      setShowParticipants(true)
      setShowChat(true)
    } else if (isMobile === true) {
      setShowParticipants(false)
      setShowChat(false)
    }
  }, [isMobile])

  const isTeacher = user?.role === 'teacher' || user?.role === 'admin' || user?.role === 'member'

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
    } else if (event.type === 'deactivate') {
      setBlackboardActive(false)
    } else {
      // Drawing events — only apply if not host (host already has the state)
      if (!isTeacher) {
        setBlackboardEvent(event)
      }
    }
  })

  // Host: broadcast blackboard canvas events
  const handleBlackboardEvent = useCallback((event: BlackboardEvent) => {
    const payload = encoder.encode(JSON.stringify(event))
    sendBlackboardData(payload, { reliable: true })
  }, [sendBlackboardData])

  // Host: toggle blackboard on/off
  const toggleBlackboard = useCallback(() => {
    const next = !blackboardActive
    setBlackboardActive(next)
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
  }, [blackboardActive, sendBlackboardData])

  // Host: send snapshot to late-joining participants
  useEffect(() => {
    if (!isTeacher || !blackboardActive) {
      prevParticipantCount.current = participants.length
      return
    }
    if (participants.length > prevParticipantCount.current) {
      // New participant joined — send current snapshot
      setTimeout(() => {
        const snapshot = blackboardRef.current?.getSnapshot()
        if (snapshot) {
          const payload = encoder.encode(JSON.stringify({ type: 'snapshot', data: snapshot }))
          sendBlackboardData(payload, { reliable: true })
        }
      }, 500)
    }
    prevParticipantCount.current = participants.length
  }, [participants.length, isTeacher, blackboardActive, sendBlackboardData])

  // Local hand raise
  const [myHandRaised, setMyHandRaised] = useState(false)
  const toggleHand = useCallback(() => {
    const newState = !myHandRaised
    setMyHandRaised(newState)
    const payload = encoder.encode(JSON.stringify({ identity: localParticipant.identity, raised: newState }))
    sendHandData(payload, { reliable: true })
  }, [myHandRaised, localParticipant.identity, sendHandData])

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
          onClose={() => setShowParticipants(false)}
        />
      )}

      {/* Center - Main Stage */}
      <div className="room-center">
        {/* Top bar */}
        <div className="room-topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {!isMobile && !showParticipants && (
              <button className="room-icon-btn" onClick={() => setShowParticipants(true)} title="Show participants">
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
              <button className="room-icon-btn" onClick={() => setShowParticipants(v => !v)} title="Participants">
                <Users size={18} />
              </button>
            )}
            <button className="room-icon-btn" onClick={() => setShowChat(v => !v)} title={showChat ? 'Hide chat' : 'Show chat'}>
              <MessageSquare size={18} />
            </button>
          </div>
        </div>

        {/* Main stage video / blackboard */}
        <MainStage
          participant={spotlightParticipant}
          screenShare={activeScreenShare}
          cameraTracks={cameraTracks}
          blackboardActive={blackboardActive}
          isHost={isTeacher}
          onCanvasEvent={handleBlackboardEvent}
          incomingEvent={blackboardEvent}
          blackboardRef={blackboardRef}
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
          onSettings={() => setShowSettings(true)}
          onLeave={handleLeave}
          raisedHandCount={raisedHands.size}
          isMobile={!!isMobile}
          isBlackboardActive={blackboardActive}
          onToggleBlackboard={toggleBlackboard}
        />
      </div>

      {/* Chat panel — overlay on mobile, sidebar on desktop */}
      {showChat && (
        <ChatPanel onClose={() => setShowChat(false)} isMobile={!!isMobile} />
      )}

      {/* Mobile: participants overlay panel */}
      {isMobile && showParticipants && (
        <div className="room-mobile-overlay" onClick={() => setShowParticipants(false)}>
          <div className="room-mobile-panel" onClick={e => e.stopPropagation()}>
            <ParticipantsPanel
              participants={participants}
              cameraTracks={cameraTracks}
              spotlightIdentity={spotlightIdentity}
              teacherIdentity={teacherParticipant?.identity || null}
              raisedHands={raisedHands}
              isTeacher={isTeacher}
              onPromote={handlePromote}
              onClose={() => setShowParticipants(false)}
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
function MainStage({ participant, screenShare, cameraTracks, blackboardActive, isHost, onCanvasEvent, incomingEvent, blackboardRef }: {
  participant: LKParticipant | undefined
  screenShare: TrackReferenceOrPlaceholder | null
  cameraTracks: TrackReferenceOrPlaceholder[]
  blackboardActive: boolean
  isHost: boolean
  onCanvasEvent: (event: BlackboardEvent) => void
  incomingEvent: BlackboardEvent | null
  blackboardRef: React.RefObject<BlackboardHandle | null>
}) {
  const speakerParticipant = participant
  const isSpeaking = useIsSpeaking(speakerParticipant)

  // If blackboard is active, show that
  if (blackboardActive) {
    return (
      <div className="room-main-stage">
        <div className="room-stage-video room-stage-blackboard">
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
      </div>
    )
  }

  // If screen share is active, show that
  if (screenShare && screenShare.publication?.track) {
    return (
      <div className="room-main-stage">
        <div className="room-stage-video room-stage-screenshare">
          <VideoTrack trackRef={screenShare} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          <div className="room-stage-overlay">
            <div className="room-stage-label">
              <Monitor size={14} />
              <span>{screenShare.participant?.name || screenShare.participant?.identity} is sharing screen</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  // Show participant camera
  const camTrack = cameraTracks.find(t => t.participant?.identity === participant?.identity)

  return (
    <div className="room-main-stage">
      <div className={`room-stage-video ${isSpeaking ? 'room-stage-speaking' : ''}`}>
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
  onSettings: () => void
  onLeave: () => void
  raisedHandCount: number
  isMobile?: boolean
  isBlackboardActive: boolean
  onToggleBlackboard: () => void
}

function ControlBarCustom({
  isMicEnabled, isCamEnabled, isScreenShareEnabled, isHandRaised,
  isTeacher, localParticipant, onToggleHand, onSettings, onLeave, raisedHandCount, isMobile,
  isBlackboardActive, onToggleBlackboard,
}: ControlBarProps) {
  const toggleMic = useCallback(() => {
    localParticipant.setMicrophoneEnabled(!isMicEnabled)
  }, [localParticipant, isMicEnabled])

  const toggleCam = useCallback(() => {
    localParticipant.setCameraEnabled(!isCamEnabled)
  }, [localParticipant, isCamEnabled])

  const toggleScreen = useCallback(() => {
    localParticipant.setScreenShareEnabled(!isScreenShareEnabled)
  }, [localParticipant, isScreenShareEnabled])

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

        {/* Blackboard — teacher only, hide on mobile */}
        {!isMobile && isTeacher && (
          <button
            className={`room-control-btn ${isBlackboardActive ? 'room-control-btn-active' : ''}`}
            onClick={onToggleBlackboard}
            title={isBlackboardActive ? 'Close blackboard' : 'Open blackboard'}
          >
            <PenTool size={20} />
            <span className="room-control-label">{isBlackboardActive ? 'Close Board' : 'Blackboard'}</span>
          </button>
        )}

        {/* Raise Hand */}
        <button
          className={`room-control-btn ${isHandRaised ? 'room-control-btn-hand' : ''}`}
          onClick={onToggleHand}
          title={isHandRaised ? 'Lower hand' : 'Raise hand'}
        >
          <Hand size={isMobile ? 18 : 20} />
          {!isMobile && <span className="room-control-label">{isHandRaised ? 'Lower Hand' : 'Raise Hand'}</span>}
          {raisedHandCount > 0 && isTeacher && (
            <span className="room-hand-badge">{raisedHandCount}</span>
          )}
        </button>

        {/* Settings — hide on mobile */}
        {!isMobile && (
          <button className="room-control-btn" onClick={onSettings} title="Settings">
            <Settings size={20} />
            <span className="room-control-label">Settings</span>
          </button>
        )}
      </div>

      {/* Leave */}
      <button className="room-control-btn room-control-btn-leave" onClick={onLeave} title="Leave room">
        <LogOut size={isMobile ? 18 : 20} />
        {!isMobile && <span className="room-control-label">Leave</span>}
      </button>
    </div>
  )
}

// ── Settings Modal ──────────────────────────────────────────────────────────
function SettingsModal({ onClose }: { onClose: () => void }) {
  const room = useRoomContext()
  const { localParticipant } = useLocalParticipant()
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