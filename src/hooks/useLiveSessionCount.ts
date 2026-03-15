'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

export function useLiveSessionCount(userId: string | undefined, isCreatorRole: boolean) {
  const [count, setCount] = useState(0)

  useEffect(() => {
    if (!userId || isCreatorRole) return
    const supabase = createClient()

    const load = async () => {
      const { data: directTargets } = await supabase
        .from('session_targets')
        .select('session_id')
        .eq('target_type', 'student')
        .eq('target_id', userId)

      const { data: myGroups } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('student_id', userId)

      let groupSessionIds: string[] = []
      if (myGroups && myGroups.length > 0) {
        const gids = myGroups.map(g => g.group_id)
        const { data: groupTargets } = await supabase
          .from('session_targets')
          .select('session_id')
          .eq('target_type', 'group')
          .in('target_id', gids)
        if (groupTargets) groupSessionIds = groupTargets.map(t => t.session_id)
      }

      const directIds = directTargets?.map(t => t.session_id) || []
      const allIds = [...new Set([...directIds, ...groupSessionIds])]

      if (allIds.length > 0) {
        const { count: c } = await supabase
          .from('sessions')
          .select('id', { count: 'exact', head: true })
          .in('id', allIds)
          .eq('status', 'live')
        setCount(c ?? 0)
      } else {
        setCount(0)
      }
    }

    load()

    const channel = supabase
      .channel('topbar-live-sessions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sessions' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_targets' }, () => load())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, isCreatorRole])

  return count
}
