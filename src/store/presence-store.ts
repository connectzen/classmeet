import { create } from 'zustand'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface PresenceUser {
  userId: string
  name: string
  avatarUrl: string | null
  onlineAt: string // ISO timestamp when they came online
}

interface PresenceState {
  /** Map of userId → PresenceUser for all currently online users */
  onlineUsers: Map<string, PresenceUser>
  /** The actual Realtime channel instance (set by AppStoreHydrator) */
  channel: RealtimeChannel | null
  /** Store the channel reference so other components can untrack */
  setChannel: (ch: RealtimeChannel | null) => void
  /** Set a user as online */
  setOnline: (user: PresenceUser) => void
  /** Remove a user (went offline) */
  setOffline: (userId: string) => void
  /** Bulk sync all currently present users */
  syncAll: (users: PresenceUser[]) => void
  /** Check if a specific user is online */
  isOnline: (userId: string) => boolean
  /** Reset completely on sign-out */
  reset: () => void
}

export const usePresenceStore = create<PresenceState>()((set, get) => ({
  onlineUsers: new Map(),
  channel: null,

  setChannel: (ch) => set({ channel: ch }),

  setOnline: (user) =>
    set((state) => {
      const next = new Map(state.onlineUsers)
      next.set(user.userId, user)
      return { onlineUsers: next }
    }),

  setOffline: (userId) =>
    set((state) => {
      const next = new Map(state.onlineUsers)
      next.delete(userId)
      return { onlineUsers: next }
    }),

  syncAll: (users) =>
    set(() => {
      const next = new Map<string, PresenceUser>()
      for (const u of users) next.set(u.userId, u)
      return { onlineUsers: next }
    }),

  isOnline: (userId) => get().onlineUsers.has(userId),

  reset: () => set({ onlineUsers: new Map(), channel: null }),
}))
