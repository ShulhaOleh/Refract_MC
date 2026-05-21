import {
  listInstances,
  getInstanceById,
  createAndSaveInstance,
  updateInstance,
  deleteInstance,
} from '../services/instance-store'
import type { CreateInstanceInput, Instance } from '@refract/core'
import { handleIpc } from './handle'
import { shell } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { paths } from '../services/paths'

export function registerInstanceIpc(): void {
  handleIpc('instance.list', () => listInstances())

  handleIpc('instance.getById', (_event, id) => getInstanceById(String(id)))

  handleIpc('instance.create', (_event, input) =>
    createAndSaveInstance(input as CreateInstanceInput)
  )

  handleIpc(
    'instance.update',
    (_event, id, patch) =>
      updateInstance(String(id), patch as Partial<Omit<Instance, 'id' | 'createdAt'>>)
  )

  handleIpc(
    'instance.delete',
    (_event, id, deleteFiles) => {
      deleteInstance(String(id), Boolean(deleteFiles))
    }
  )

  handleIpc('instance.openFolder', (_event, id) => {
    const gameDir = join(paths.instances, String(id), 'minecraft')
    if (!existsSync(gameDir)) mkdirSync(gameDir, { recursive: true })
    shell.openPath(gameDir)
  })
}
