import { invoke } from '@tauri-apps/api/core'

// This is the Tauri equivalent of the Electron preload's `window.api`. In the
// full migration, the renderer's `lib/api.ts` would route here (invoke) instead
// of `ipcRenderer`. For the POC we only port the `config` surface.
export interface AppConfig {
  activeAccountId: string | null
  activeThemeId: string
  defaultMemoryMb: number
  onboardingDone: boolean
  analyticsEnabled?: boolean
  [key: string]: unknown
}

export const configApi = {
  get: (): Promise<AppConfig> => invoke<AppConfig>('config_get'),
  set: (key: string, value: unknown): Promise<AppConfig> =>
    invoke<AppConfig>('config_set', { key, value }),
}
