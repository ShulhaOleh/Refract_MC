import { ipcMain } from 'electron'
import { join, extname, basename } from 'path'
import { readdirSync, renameSync, rmSync, statSync, existsSync } from 'fs'
import { handleIpc } from './handle'
import { paths } from '../services/paths'

export interface ModEntry {
  filename: string
  displayName: string
  enabled: boolean
  sizeKb: number
}

function modsDir(instanceId: string): string {
  return join(paths.instances, instanceId, 'minecraft', 'mods')
}

function listMods(instanceId: string): ModEntry[] {
  const dir = modsDir(instanceId)
  if (!existsSync(dir)) return []
  return readdirSync(dir)
    .filter(f => f.endsWith('.jar') || f.endsWith('.jar.disabled'))
    .map(filename => {
      const enabled = filename.endsWith('.jar')
      const displayName = filename.replace(/\.jar(\.disabled)?$/, '')
      const sizeKb = Math.round(statSync(join(dir, filename)).size / 1024)
      return { filename, displayName, enabled, sizeKb }
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName))
}

export function registerModsIpc(): void {
  handleIpc('mods.list', (_e, instanceId) => listMods(String(instanceId)))

  handleIpc('mods.toggle', (_e, instanceId, filename) => {
    const id = String(instanceId)
    const file = String(filename)
    const dir = modsDir(id)
    const src = join(dir, file)
    if (!existsSync(src)) throw new Error(`Mod not found: ${file}`)

    const dst = file.endsWith('.jar.disabled')
      ? join(dir, file.replace(/\.disabled$/, ''))
      : join(dir, file + '.disabled')

    renameSync(src, dst)
  })

  handleIpc('mods.delete', (_e, instanceId, filename) => {
    const id = String(instanceId)
    const file = String(filename)
    const dir = modsDir(id)
    const src = join(dir, file)
    if (!existsSync(src)) return
    rmSync(src)
  })
}
