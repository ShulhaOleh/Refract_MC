import { getCurrentWindow, type DragDropEvent } from '@tauri-apps/api/window'

type DropHandler = (paths: string[]) => void
type HoverHandler = (hovering: boolean) => void

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
const handlers = new Map<string, { drop: DropHandler; hover?: HoverHandler }>()
let unlistenPromise: Promise<(() => void)> | null = null
let lastHoverId: string | null = null

function dropTargetIdAt(position?: { x: number; y: number }): string | null {
  if (!position) return null
  const scale = window.devicePixelRatio || 1
  const el = document.elementFromPoint(position.x / scale, position.y / scale)
  return el?.closest<HTMLElement>('[data-instance-drop-id]')?.dataset.instanceDropId ?? null
}

function setHover(nextId: string | null) {
  if (lastHoverId === nextId) return
  if (lastHoverId) handlers.get(lastHoverId)?.hover?.(false)
  lastHoverId = nextId
  if (lastHoverId) handlers.get(lastHoverId)?.hover?.(true)
}

async function ensureListener() {
  if (!isTauri || unlistenPromise) return
  unlistenPromise = getCurrentWindow().onDragDropEvent(({ payload }: { payload: DragDropEvent }) => {
    if (payload.type === 'enter' || payload.type === 'over') {
      setHover(dropTargetIdAt(payload.position))
      return
    }
    if (payload.type === 'drop') {
      const id = dropTargetIdAt(payload.position) ?? lastHoverId
      setHover(null)
      if (id && payload.paths.length > 0) handlers.get(id)?.drop(payload.paths)
      return
    }
    setHover(null)
  })
}

export function registerNativeDropTarget(id: string, drop: DropHandler, hover?: HoverHandler): () => void {
  handlers.set(id, { drop, hover })
  void ensureListener()
  return () => {
    handlers.delete(id)
    if (lastHoverId === id) lastHoverId = null
  }
}

