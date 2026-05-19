import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { themeEngine } from '@/lib/theme-engine'
import type { ThemeDefinition, LayoutConfig } from '@/lib/theme-types'
import darkTheme from '@/lib/themes/dark.json'
import lightTheme from '@/lib/themes/light.json'

const BUILTIN_THEMES: Record<string, ThemeDefinition> = {
  dark: darkTheme as ThemeDefinition,
  light: lightTheme as ThemeDefinition,
}

interface ThemeStore {
  activeThemeId: string
  activeTheme: ThemeDefinition
  customThemes: ThemeDefinition[]
  layoutOverrides: Partial<LayoutConfig>
  sidebarCollapsed: boolean

  applyTheme: (theme: ThemeDefinition) => void
  applyBuiltin: (id: 'dark' | 'light') => void
  addCustomTheme: (theme: ThemeDefinition) => void
  setLayoutOverride: (override: Partial<LayoutConfig>) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  initialize: () => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      activeThemeId: 'dark',
      activeTheme: darkTheme as ThemeDefinition,
      customThemes: [],
      layoutOverrides: {},
      sidebarCollapsed: false,

      applyTheme: (theme) => {
        themeEngine.apply({ ...theme, layout: { ...theme.layout, ...get().layoutOverrides } })
        set({ activeThemeId: theme.id, activeTheme: theme })
      },

      applyBuiltin: (id) => {
        const theme = BUILTIN_THEMES[id]
        if (theme) get().applyTheme(theme)
      },

      addCustomTheme: (theme) => {
        set((s) => ({
          customThemes: [...s.customThemes.filter((t) => t.id !== theme.id), theme],
        }))
        get().applyTheme(theme)
      },

      setLayoutOverride: (override) => {
        const merged = { ...get().layoutOverrides, ...override }
        set({ layoutOverrides: merged })
        themeEngine.apply({ ...get().activeTheme, layout: merged })
      },

      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),

      initialize: () => {
        const { activeThemeId, customThemes, layoutOverrides, activeTheme } = get()
        const theme =
          BUILTIN_THEMES[activeThemeId] ??
          customThemes.find((t) => t.id === activeThemeId) ??
          activeTheme
        themeEngine.apply({ ...theme, layout: { ...theme.layout, ...layoutOverrides } })
      },
    }),
    {
      name: 'refract-theme',
      partialize: (s) => ({
        activeThemeId: s.activeThemeId,
        customThemes: s.customThemes,
        layoutOverrides: s.layoutOverrides,
        sidebarCollapsed: s.sidebarCollapsed,
      }),
    }
  )
)
