'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { useAppStore } from '@/store/app-store'
import { createClient } from '@/lib/supabase/client'
import Button from '@/components/ui/Button'
import Input from '@/components/ui/Input'
import Avatar from '@/components/ui/Avatar'
import {
  MessageSquare, Send, Plus, Search, ArrowLeft, X, Check, Users, User,
} from 'lucide-react'
import { useToast } from '@/hooks/useToast'

// ── Types ─────────────────────────────────────────────────────────────────────
interface ConversationItem {
  id: string
  type: 'direct' | 'group'
  name: string
  avatarUrl: string | null
  lastMessage: string
  lastMessageAt: string
  unread: number
  participantIds: string[]
}

interface MessageItem {
  id: string
  senderId: string
  senderName: string
  senderAvatar: string | null
  content: string
  createdAt: string
  isMine: boolean
}

interface ContactItem {
  id: string
  name: string
  avatarUrl: string | null
  role: string
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'now'
  if (mins < 60) return `${mins}m`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h`
  const days = Math.floor(hrs / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function formatTime(dateStr: string) {
  return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function MessagesPage() {
  const user = useAppStore(s => s.user)
  const { toast, show: showToast } = useToast()
  const supabase = createClient()

  // State
  const [conversations, setConversations] = useState<ConversationItem[]>([])
  const [activeConvId, setActiveConvId] = useState<string | null>(null)
  const [messages, setMessages] = useState<MessageItem[]>([])
  const [msgInput, setMsgInput] = useState('')
  const [sending, setSending] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewChat, setShowNewChat] = useState(false)
  const [contacts, setContacts] = useState<ContactItem[]>([])
  const [contactSearch, setContactSearch] = useState('')
  const [loadingConvs, setLoadingConvs] = useState(true)
  const [loadingMsgs, setLoadingMsgs] = useState(false)
  const [mobileShowChat, setMobileShowChat] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const profileCacheRef = useRef<Map<string, { name: string; avatar: string | null }>>(new Map())

  // ── Profile cache helper ──
  const getProfile = useCallback(async (userId: string) => {
    const cached = profileCacheRef.current.get(userId)
    if (cached) return cached
    const { data } = await supabase.from('profiles').select('full_name, avatar_url').eq('id', userId).single()
    const profile = { name: data?.full_name || 'Unknown', avatar: data?.avatar_url || null }
    profileCacheRef.current.set(userId, profile)
    return profile
  }, [])

  // ── Load conversations ──
  const loadConversations = useCallback(async () => {
    if (!user?.id) return

    // Get all conversations user participates in
    const { data: myParticipations } = await supabase
      .from('conversation_participants')
      .select('conversation_id, last_read_at')
      .eq('user_id', user.id)

    if (!myParticipations || myParticipations.length === 0) {
      setConversations([])
      setLoadingConvs(false)
      return
    }

    const convIds = myParticipations.map(p => p.conversation_id)
    const readMap = new Map(myParticipations.map(p => [p.conversation_id, p.last_read_at]))

    // Get conversation details
    const { data: convs } = await supabase
      .from('conversations')
      .select('id, type, name, created_at')
      .in('id', convIds)

    if (!convs) { setConversations([]); setLoadingConvs(false); return }

    // Get all participants for these conversations
    const { data: allParticipants } = await supabase
      .from('conversation_participants')
      .select('conversation_id, user_id')
      .in('conversation_id', convIds)

    // Batch: fetch the most recent messages for ALL conversations in one query
    const { data: recentMsgs } = await supabase
      .from('messages')
      .select('id, conversation_id, content, created_at, sender_id')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(500)

    // Build last-message and unread maps — O(messages) in JS, no extra DB round-trips
    const lastMsgMap = new Map<string, { content: string; created_at: string; sender_id: string }>()
    const unreadMap = new Map<string, number>()

    for (const msg of recentMsgs ?? []) {
      if (!lastMsgMap.has(msg.conversation_id)) {
        lastMsgMap.set(msg.conversation_id, msg)
      }
      const lastRead = readMap.get(msg.conversation_id) || ''
      if (msg.sender_id !== user.id && (!lastRead || msg.created_at > lastRead)) {
        unreadMap.set(msg.conversation_id, (unreadMap.get(msg.conversation_id) ?? 0) + 1)
      }
    }

    // Batch: fetch all direct-conversation partner profiles in one query
    const directPartnerIds = convs
      .filter(c => c.type === 'direct')
      .flatMap(c => {
        const parts = allParticipants?.filter(p => p.conversation_id === c.id) ?? []
        const other = parts.find(p => p.user_id !== user.id)
        return other ? [other.user_id] : []
      })
    const uncachedIds = [...new Set(directPartnerIds)].filter(
      id => !profileCacheRef.current.has(id)
    )
    if (uncachedIds.length > 0) {
      const { data: partnerProfiles } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url')
        .in('id', uncachedIds)
      for (const p of partnerProfiles ?? []) {
        profileCacheRef.current.set(p.id, { name: p.full_name || 'Unknown', avatar: p.avatar_url })
      }
    }

    // Build final conversation items — pure JS, no more DB queries
    const items: ConversationItem[] = convs.map(conv => {
      const participants = allParticipants?.filter(p => p.conversation_id === conv.id) || []
      const participantIds = participants.map(p => p.user_id)

      let displayName = conv.name || 'Group Chat'
      let avatarUrl: string | null = null

      if (conv.type === 'direct') {
        const otherId = participantIds.find(id => id !== user.id)
        if (otherId) {
          const profile = profileCacheRef.current.get(otherId)
          if (profile) { displayName = profile.name; avatarUrl = profile.avatar }
        }
      }

      const lastMsg = lastMsgMap.get(conv.id)
      return {
        id: conv.id,
        type: conv.type as 'direct' | 'group',
        name: displayName,
        avatarUrl,
        lastMessage: lastMsg?.content || '',
        lastMessageAt: lastMsg?.created_at || conv.created_at,
        unread: unreadMap.get(conv.id) ?? 0,
        participantIds,
      }
    })

    // Sort by last message time
    items.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
    setConversations(items)
    setLoadingConvs(false)
  }, [user?.id])

  // ── Load messages for active conversation ──
  const loadMessages = useCallback(async (convId: string) => {
    if (!user?.id) return
    setLoadingMsgs(true)

    const { data: msgs } = await supabase
      .from('messages')
      .select('id, sender_id, content, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
      .limit(200)

    if (msgs) {
      const items: MessageItem[] = []
      for (const m of msgs) {
        const profile = await getProfile(m.sender_id)
        items.push({
          id: m.id,
          senderId: m.sender_id,
          senderName: profile.name,
          senderAvatar: profile.avatar,
          content: m.content,
          createdAt: m.created_at,
          isMine: m.sender_id === user.id,
        })
      }
      setMessages(items)
    }

    // Mark as read
    await supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', convId)
      .eq('user_id', user.id)

    // Update unread count in sidebar
    setConversations(prev => prev.map(c => c.id === convId ? { ...c, unread: 0 } : c))

    setLoadingMsgs(false)
  }, [user?.id, getProfile])

  // ── Initial load ──
  useEffect(() => { loadConversations() }, [loadConversations])

  // ── Load messages when switching conversation ──
  useEffect(() => {
    if (activeConvId) loadMessages(activeConvId)
    else setMessages([])
  }, [activeConvId, loadMessages])

  // ── Scroll to bottom when messages change ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // ── Realtime subscription for new messages ──
  useEffect(() => {
    if (!user?.id) return

    const channel = supabase
      .channel('messages-realtime')
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'messages',
      }, async (payload) => {
        const newMsg = payload.new as { id: string; conversation_id: string; sender_id: string; content: string; created_at: string }

        // Check if this message is for a conversation we're in
        const isInConv = conversations.some(c => c.id === newMsg.conversation_id)

        if (isInConv) {
          // Update conversation list
          setConversations(prev => {
            const updated = prev.map(c => {
              if (c.id === newMsg.conversation_id) {
                return {
                  ...c,
                  lastMessage: newMsg.content,
                  lastMessageAt: newMsg.created_at,
                  unread: c.id === activeConvId ? 0 : c.unread + (newMsg.sender_id !== user.id ? 1 : 0),
                }
              }
              return c
            })
            return updated.sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime())
          })

          // If this is the active conversation, add the message to view
          if (newMsg.conversation_id === activeConvId && newMsg.sender_id !== user.id) {
            const profile = await getProfile(newMsg.sender_id)
            setMessages(prev => [...prev, {
              id: newMsg.id,
              senderId: newMsg.sender_id,
              senderName: profile.name,
              senderAvatar: profile.avatar,
              content: newMsg.content,
              createdAt: newMsg.created_at,
              isMine: false,
            }])

            // Mark as read
            await supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', activeConvId)
              .eq('user_id', user.id)
          }
        } else {
          // New conversation we didn't know about - reload
          loadConversations()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, activeConvId, conversations, loadConversations, getProfile])

  // ── Send message ──
  async function handleSend() {
    if (!msgInput.trim() || !activeConvId || !user?.id || sending) return
    const content = msgInput.trim()
    setSending(true)
    setMsgInput('')

    // Optimistic update
    const tempId = `temp-${Date.now()}`
    setMessages(prev => [...prev, {
      id: tempId,
      senderId: user.id,
      senderName: user.fullName || 'You',
      senderAvatar: user.avatarUrl || null,
      content,
      createdAt: new Date().toISOString(),
      isMine: true,
    }])

    const { error } = await supabase.from('messages').insert({
      conversation_id: activeConvId,
      sender_id: user.id,
      content,
    })

    if (error) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== tempId))
      showToast('Failed to send message')
    } else {
      // Replace temp with real – or just reload
      loadMessages(activeConvId)
    }

    setSending(false)
  }

  // ── Load contacts for new chat ──
  async function loadContacts() {
    if (!user?.id) return

    const isCreator = user.role === 'teacher' || user.role === 'admin'
    const items: ContactItem[] = []

    if (isCreator) {
      // Get students
      const { data: enrollments } = await supabase
        .from('teacher_students')
        .select('student_id')
        .eq('teacher_id', user.id)
      if (enrollments && enrollments.length > 0) {
        const ids = enrollments.map(e => e.student_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', ids)
        if (profiles) {
          items.push(...profiles.map(p => ({
            id: p.id,
            name: p.full_name || 'Unknown',
            avatarUrl: p.avatar_url,
            role: p.role || 'student',
          })))
        }
      }
    } else {
      // Get teachers
      const { data: enrollments } = await supabase
        .from('teacher_students')
        .select('teacher_id')
        .eq('student_id', user.id)
      if (enrollments && enrollments.length > 0) {
        const ids = enrollments.map(e => e.teacher_id)
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, avatar_url, role')
          .in('id', ids)
        if (profiles) {
          items.push(...profiles.map(p => ({
            id: p.id,
            name: p.full_name || 'Unknown',
            avatarUrl: p.avatar_url,
            role: p.role || 'teacher',
          })))
        }
      }
    }

    setContacts(items)
  }

  // ── Start new conversation ──
  async function startConversation(contactId: string) {
    if (!user?.id) return

    // Check if a direct conversation already exists
    const existing = conversations.find(c =>
      c.type === 'direct' &&
      c.participantIds.includes(contactId) &&
      c.participantIds.includes(user.id)
    )

    if (existing) {
      setActiveConvId(existing.id)
      setShowNewChat(false)
      setMobileShowChat(true)
      return
    }

    // Create new conversation
    const { data: conv, error: convErr } = await supabase
      .from('conversations')
      .insert({ type: 'direct', name: null, created_by: user.id })
      .select('id')
      .single()

    if (convErr || !conv) {
      showToast(convErr?.message ? `Failed to create conversation: ${convErr.message}` : 'Failed to create conversation')
      return
    }

    // Add both participants
    const { error: participantErr } = await supabase.from('conversation_participants').insert([
      { conversation_id: conv.id, user_id: user.id },
      { conversation_id: conv.id, user_id: contactId },
    ])

    if (participantErr) {
      showToast(participantErr.message ? `Failed to add participants: ${participantErr.message}` : 'Failed to add participants')
      return
    }

    setShowNewChat(false)
    await loadConversations()
    setActiveConvId(conv.id)
    setMobileShowChat(true)
  }

  // ── Filtered conversations ──
  const filteredConvs = conversations.filter(c =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredContacts = contacts.filter(c =>
    c.name.toLowerCase().includes(contactSearch.toLowerCase())
  )

  const activeConv = conversations.find(c => c.id === activeConvId)
  const totalUnread = conversations.reduce((sum, c) => sum + c.unread, 0)

  // ── Render ──
  return (
    <div style={{ height: 'calc(100vh - 80px)', display: 'flex', flexDirection: 'column', maxWidth: '1100px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexShrink: 0 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Messages {totalUnread > 0 && <span style={{ fontSize: '0.8rem', color: 'var(--primary-400)', fontWeight: 600 }}>({totalUnread})</span>}
          </h1>
          <p style={{ margin: '4px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
            Real-time chat between teachers and students
          </p>
        </div>
        <Button icon={<Plus size={15} />} size="sm" onClick={() => { setShowNewChat(true); loadContacts() }}>
          New Chat
        </Button>
      </div>

      {/* Main chat area */}
      <div className="card" style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: 0, minHeight: 0 }}>

        {/* ── Conversation List (left panel) ── */}
        <div style={{
          width: '320px', minWidth: '280px', borderRight: '1px solid var(--border-subtle)',
          display: 'flex', flexDirection: 'column',
          ...(mobileShowChat ? { display: 'none' } : {}),
        }}
          className="messages-sidebar"
        >
          {/* Search */}
          <div style={{ padding: '12px', borderBottom: '1px solid var(--border-subtle)' }}>
            <Input
              placeholder="Search conversations…"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              leftIcon={<Search size={14} />}
            />
          </div>

          {/* Conversation list */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loadingConvs ? (
              <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>Loading…</div>
            ) : filteredConvs.length === 0 ? (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <MessageSquare size={32} color="var(--text-muted)" style={{ marginBottom: '12px', opacity: 0.4 }} />
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem', margin: '0 0 16px' }}>
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
                </p>
                {!searchQuery && (
                  <Button size="sm" variant="outline" icon={<Plus size={14} />} onClick={() => { setShowNewChat(true); loadContacts() }}>
                    Start a chat
                  </Button>
                )}
              </div>
            ) : (
              filteredConvs.map(conv => (
                <div
                  key={conv.id}
                  onClick={() => { setActiveConvId(conv.id); setMobileShowChat(true) }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && (setActiveConvId(conv.id), setMobileShowChat(true))}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '12px',
                    padding: '12px 16px', cursor: 'pointer',
                    background: conv.id === activeConvId ? 'var(--bg-elevated)' : 'transparent',
                    borderBottom: '1px solid var(--border-subtle)',
                    transition: 'background 0.15s',
                  }}
                  onMouseEnter={e => { if (conv.id !== activeConvId) e.currentTarget.style.background = 'var(--bg-overlay)' }}
                  onMouseLeave={e => { if (conv.id !== activeConvId) e.currentTarget.style.background = 'transparent' }}
                >
                  <Avatar src={conv.avatarUrl} name={conv.name} size="sm" />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '2px' }}>
                      <span style={{ fontWeight: conv.unread > 0 ? 700 : 500, fontSize: '0.88rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {conv.name}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', flexShrink: 0, marginLeft: '8px' }}>
                        {conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : ''}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span style={{
                        fontSize: '0.78rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        color: conv.unread > 0 ? 'var(--text-secondary)' : 'var(--text-muted)',
                        fontWeight: conv.unread > 0 ? 500 : 400,
                      }}>
                        {conv.lastMessage || 'No messages yet'}
                      </span>
                      {conv.unread > 0 && (
                        <span style={{
                          flexShrink: 0, marginLeft: '8px',
                          width: 20, height: 20, borderRadius: '50%',
                          background: 'var(--primary-500)', color: '#fff',
                          fontSize: '0.65rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>
                          {conv.unread > 9 ? '9+' : conv.unread}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ── Message Area (right panel) ── */}
        <div style={{
          flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0,
          ...(!mobileShowChat && !activeConvId ? {} : {}),
        }}
          className="messages-content"
        >
          {activeConvId && activeConv ? (
            <>
              {/* Chat header */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '12px',
                padding: '12px 16px', borderBottom: '1px solid var(--border-subtle)',
                background: 'var(--bg-elevated)',
              }}>
                <button
                  className="btn btn-ghost btn-icon btn-sm messages-back-btn"
                  onClick={() => { setMobileShowChat(false); setActiveConvId(null) }}
                  style={{ display: 'none' }}
                >
                  <ArrowLeft size={18} />
                </button>
                <Avatar src={activeConv.avatarUrl} name={activeConv.name} size="sm" />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>{activeConv.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {activeConv.type === 'direct' ? 'Direct message' : `${activeConv.participantIds.length} participants`}
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                {loadingMsgs ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '40px' }}>Loading messages…</div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', padding: '40px' }}>
                    No messages yet. Say hello!
                  </div>
                ) : (
                  <>
                    {messages.map((msg, i) => {
                      const showAvatar = !msg.isMine && (i === 0 || messages[i - 1]?.senderId !== msg.senderId)
                      const showName = showAvatar
                      const isLast = i === messages.length - 1 || messages[i + 1]?.senderId !== msg.senderId

                      return (
                        <div key={msg.id} style={{
                          display: 'flex',
                          flexDirection: msg.isMine ? 'row-reverse' : 'row',
                          alignItems: 'flex-end',
                          gap: '8px',
                          marginTop: showAvatar ? '12px' : '2px',
                        }}>
                          {/* Avatar area */}
                          <div style={{ width: 28, flexShrink: 0 }}>
                            {showAvatar && !msg.isMine && (
                              <Avatar src={msg.senderAvatar} name={msg.senderName} size="xs" />
                            )}
                          </div>

                          {/* Bubble */}
                          <div style={{ maxWidth: '70%' }}>
                            {showName && !msg.isMine && (
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '2px', marginLeft: '4px' }}>
                                {msg.senderName}
                              </div>
                            )}
                            <div style={{
                              padding: '8px 14px',
                              borderRadius: msg.isMine
                                ? `var(--radius-lg) var(--radius-lg) ${isLast ? '4px' : 'var(--radius-lg)'} var(--radius-lg)`
                                : `var(--radius-lg) var(--radius-lg) var(--radius-lg) ${isLast ? '4px' : 'var(--radius-lg)'}`,
                              background: msg.isMine
                                ? 'var(--primary-500)'
                                : 'var(--bg-elevated)',
                              color: msg.isMine ? '#fff' : 'var(--text-primary)',
                              fontSize: '0.88rem',
                              lineHeight: 1.5,
                              wordBreak: 'break-word',
                            }}>
                              {msg.content}
                            </div>
                            {isLast && (
                              <div style={{
                                fontSize: '0.65rem', color: 'var(--text-muted)',
                                marginTop: '2px',
                                textAlign: msg.isMine ? 'right' : 'left',
                                paddingLeft: msg.isMine ? 0 : '4px',
                                paddingRight: msg.isMine ? '4px' : 0,
                              }}>
                                {formatTime(msg.createdAt)}
                              </div>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '12px 16px', borderTop: '1px solid var(--border-subtle)',
                background: 'var(--bg-surface)',
              }}>
                <div style={{ flex: 1 }}>
                  <input
                    className="input"
                    placeholder="Type a message…"
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                    style={{ width: '100%' }}
                    autoComplete="off"
                  />
                </div>
                <Button
                  icon={<Send size={16} />}
                  onClick={handleSend}
                  disabled={!msgInput.trim() || sending}
                  size="sm"
                >
                  Send
                </Button>
              </div>
            </>
          ) : (
            /* Empty state */
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', padding: '40px' }}>
              <div style={{
                width: 80, height: 80, borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(168,85,247,0.1))',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: '20px',
              }}>
                <MessageSquare size={32} color="var(--primary-400)" />
              </div>
              <h3 style={{ margin: '0 0 8px', color: 'var(--text-primary)', fontWeight: 600 }}>Select a conversation</h3>
              <p style={{ margin: '0 0 20px', fontSize: '0.875rem', color: 'var(--text-muted)', textAlign: 'center', maxWidth: '300px' }}>
                Choose an existing conversation or start a new chat
              </p>
              <Button variant="outline" icon={<Plus size={14} />} size="sm" onClick={() => { setShowNewChat(true); loadContacts() }}>
                New Chat
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* ── New Chat Modal ── */}
      {showNewChat && (
        <div className="modal-container" style={{ backgroundColor: 'rgba(0,0,0,0.6)' }} onClick={() => setShowNewChat(false)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: '420px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>New Conversation</h2>
                <p style={{ margin: '4px 0 0', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Select a person to chat with</p>
              </div>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setShowNewChat(false)} aria-label="Close"><X size={18} /></button>
            </div>

            <div style={{ marginBottom: '16px' }}>
              <Input
                placeholder="Search contacts…"
                value={contactSearch}
                onChange={e => setContactSearch(e.target.value)}
                leftIcon={<Search size={14} />}
              />
            </div>

            <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
              {filteredContacts.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  {contacts.length === 0
                    ? 'No contacts available. Students or teachers need to be connected first.'
                    : 'No contacts match your search'}
                </div>
              ) : (
                filteredContacts.map(contact => (
                  <div
                    key={contact.id}
                    onClick={() => startConversation(contact.id)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && startConversation(contact.id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '12px',
                      padding: '10px 12px', borderRadius: 'var(--radius-md)',
                      cursor: 'pointer', transition: 'background 0.15s',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                  >
                    <Avatar src={contact.avatarUrl} name={contact.name} size="sm" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>{contact.name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>{contact.role}</div>
                    </div>
                    <MessageSquare size={16} color="var(--text-muted)" />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Mobile responsive styles */}
      <style>{`
        @media (max-width: 640px) {
          .messages-sidebar {
            width: 100% !important;
            min-width: unset !important;
            border-right: none !important;
            ${mobileShowChat ? 'display: none !important;' : 'display: flex !important;'}
          }
          .messages-content {
            ${!mobileShowChat ? 'display: none !important;' : 'display: flex !important;'}
          }
          .messages-back-btn {
            display: flex !important;
          }
        }
      `}</style>

      {toast && <div className="toast toast-info" role="status" aria-live="polite">{toast}</div>}
    </div>
  )
}

