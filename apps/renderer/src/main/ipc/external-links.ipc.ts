import { shell } from 'electron'
import { handleIpc } from './handle'

const ALLOWED_EXTERNAL_HOSTS = new Set([
  'www.minecraft.net',
  'minecraft.net',
  'modrinth.com',
  'www.curseforge.com',
  'curseforge.com',
  'github.com',
  'www.github.com',
  'gitlab.com',
  'www.gitlab.com',
  'bitbucket.org',
  'www.bitbucket.org',
  'codeberg.org',
  'www.codeberg.org',
  'discord.gg',
  'discord.com',
  'www.discord.com',
  'discordapp.com',
  'namemc.com',
  'www.namemc.com',
])

export function validateExternalUrl(value: string): string {
  const url = new URL(value)
  if (url.protocol !== 'https:' || !ALLOWED_EXTERNAL_HOSTS.has(url.hostname.toLowerCase())) {
    throw new Error('External link is not allowed.')
  }
  return url.toString()
}

export function registerExternalLinksIpc(): void {
  handleIpc('external.open', async (_event, value) => {
    await shell.openExternal(validateExternalUrl(String(value)))
  })
}
