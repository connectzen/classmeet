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

      let total = 0
      for (const p of participations) {
        const { count: c } = await supabase
          .from('messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', p.conversation_id)
          .neq('sender_id', userId)
          .gt('created_at', p.last_read_at || '1970-01-01T00:00:00Z')
        total += c || 0
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
