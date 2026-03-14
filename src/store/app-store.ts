import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserRole } from '@/lib/supabase/types'

type UIPanelType = 'none' | 'notifications' | 'settings' | 'profile' | 'search'

interface AppUser {
  id: string
  email: string
  fullName: string
  avatarUrl: string | null
  role: UserRole
  onboardingComplete: boolean
}

interface AppState {
  // User
  user: AppUser | null
  setUser: (user: AppUser | null) => void
  updateUser: (updates: Partial<AppUser>) => void

  // UI
  activePanel: UIPanelType
  setActivePanel: (panel: UIPanelType) => void
  sidebarOpen: boolean
  setSidebarOpen: (open: boolean) => void
  toggleSidebar: () => void

  // Hydration
  hydrated: boolean
  setHydrated: () => void
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      setUser: (user) => set({ user }),
      updateUser: (updates) => {
        const { user } = get()
        if (user) set({ user: { ...user, ...updates } })
      },

      activePanel: 'none',
      setActivePanel: (panel) => set({ activePanel: panel }),

      sidebarOpen: false,
      setSidebarOpen: (open) => set({ sidebarOpen: open }),
      toggleSidebar: () => set((s) => ({ sidebarOpen: !s.sidebarOpen })),

      hydrated: false,
      setHydrated: () => set({ hydrated: true }),
    }),
    {
      name: 'classmeet-app',
      partialize: (s) => ({ user: s.user, sidebarOpen: s.sidebarOpen }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated()
      },
    }
  )
)

