'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export function useUnreadMessageCount(userId: string | undefined) {
  const [count, setCount] = useState(0)
  const pathname = usePathname()
  const isOnMessages = pathname?.startsWith('/dashboard/messages') ?? false

  useEffect(() => {
    if (!userId || isOnMessages) {
      setCount(0)
      return
    }

    const supabase = createClient()

    const load = async () => {
      const { data: participations } = await supabase
        .from('conversation_participants')
        .select('conversation_id, last_read_at')
        .eq('user_id', userId)

      if (!participations || participations.length === 0) {
        setCount(0)
        return
      }

      const convIds = participations.map(p => p.conversation_id)
      const readMap = new Map(
        participations.map(p => [p.conversation_id, p.last_read_at || '1970-01-01T00:00:00Z'])
      )

      // Use the earliest last_read_at as a lower bound so we can fetch all
      // potentially-unread messages in ONE query instead of N queries
      const earliestRead = [...readMap.values()].reduce(
        (min, d) => (d < min ? d : min),
        new Date().toISOString()
      )

      const { data: messages } = await supabase
        .from('messages')
        .select('conversation_id, sender_id, created_at')
        .in('conversation_id', convIds)
        .neq('sender_id', userId)
        .gt('created_at', earliestRead)

      // Count per-conversation using each conv's own last_read_at
      let total = 0
      for (const msg of messages ?? []) {
        const lastRead = readMap.get(msg.conversation_id) ?? '1970-01-01T00:00:00Z'
        if (msg.created_at > lastRead) total++
      }
      setCount(total)
    }

    load()

    const channel = supabase
      .channel('topbar-unread-msgs')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => load())
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, isOnMessages])

  return count
}
