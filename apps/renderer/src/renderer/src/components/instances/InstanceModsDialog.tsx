import { useState, useEffect, useCallback } from 'react'
import { api } from '@/lib/api'
import type { Instance } from '@refract/core'

type ModEntry = { filename: string; displayName: string; enabled: boolean; sizeKb: number }

interface Props {
  instance: Instance | null
  open: boolean
  onOpenChange: (v: boolean) => void
}

export function InstanceModsDialog({ instance, open, onOpenChange }: Props) {
  const [mods, setMods] = useState<ModEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState<Set<string>>(new Set())
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!instance) return
    setLoading(true)
    setError(null)
    try {
      const list = await api.mods.list(instance.id)
      setMods(list)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setLoading(false)
    }
  }, [instance])

  useEffect(() => {
    if (open) { setMods([]); load() }
  }, [open, load])

  if (!open || !instance) return null

  async function handleToggle(filename: string) {
    if (!instance) return
    setBusy(prev => new Set([...prev, filename]))
    try {
      await api.mods.toggle(instance.id, filename)
      await load()
    } catch { /* ignore */ } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(filename); return n })
    }
  }

  async function handleDelete(filename: string) {
    if (!instance) return
    setBusy(prev => new Set([...prev, filename]))
    try {
      await api.mods.delete(instance.id, filename)
      setMods(prev => prev.filter(m => m.filename !== filename))
    } catch { /* ignore */ } finally {
      setBusy(prev => { const n = new Set(prev); n.delete(filename); return n })
    }
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 150,
        background: 'rgba(0,0,0,.65)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={() => onOpenChange(false)}
    >
      <div
        style={{
          width: 560, maxHeight: '78vh',
          background: 'var(--surface)',
          border: '1px solid var(--border-r)',
          borderRadius: 'var(--radius)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-r)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontFamily: "'VT323',monospace", fontSize: 17, color: 'var(--ink)', letterSpacing: '.08em' }}>
              MODS — {instance.name}
            </div>
            <div style={{ fontSize: 11, color: 'var(--ink-4)', marginTop: 2 }}>
              MC {instance.minecraftVersion} · {instance.modLoader?.toUpperCase() ?? 'VANILLA'} · {mods.length} mod{mods.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button
              onClick={load}
              style={{
                fontSize: 11, color: 'var(--ink-3)',
                background: 'var(--surface-2)', border: '1px solid var(--border-r)',
                borderRadius: 3, padding: '3px 10px', cursor: 'pointer',
              }}
            >
              Refresh
            </button>
            <button
              onClick={() => onOpenChange(false)}
              style={{ background: 'none', border: 'none', color: 'var(--ink-4)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}
            >
              ✕
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px 0' }}>
          {loading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ink-4)', fontSize: 13 }}>
              Loading…
            </div>
          ) : error ? (
            <div style={{ padding: '20px 16px', color: 'var(--lava)', fontSize: 12 }}>{error}</div>
          ) : mods.length === 0 ? (
            <div style={{ padding: '40px 16px', textAlign: 'center' }}>
              <div style={{ fontFamily: "'VT323',monospace", fontSize: 16, color: 'var(--ink-4)', letterSpacing: '.08em', marginBottom: 6 }}>
                NO MODS INSTALLED
              </div>
              <div style={{ fontSize: 12, color: 'var(--ink-4)' }}>
                Install mods from the Content Browser.
              </div>
            </div>
          ) : mods.map(mod => (
            <ModRow
              key={mod.filename}
              mod={mod}
              isBusy={busy.has(mod.filename)}
              onToggle={() => handleToggle(mod.filename)}
              onDelete={() => handleDelete(mod.filename)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

function ModRow({ mod, isBusy, onToggle, onDelete }: {
  mod: ModEntry
  isBusy: boolean
  onToggle: () => void
  onDelete: () => void
}) {
  const [confirmDelete, setConfirmDelete] = useState(false)

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '8px 16px',
      borderBottom: '1px solid var(--line)',
      opacity: isBusy ? 0.5 : 1,
      transition: 'opacity 150ms',
    }}>
      {/* Cube icon */}
      <div style={{
        width: 28, height: 28, flexShrink: 0,
        background: mod.enabled ? 'var(--accent-tint)' : 'var(--surface-2)',
        border: `1px solid ${mod.enabled ? 'var(--accent)' : 'var(--border-r)'}`,
        borderRadius: 3,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ width: 12, height: 12, background: mod.enabled ? 'var(--accent)' : 'var(--ink-4)', borderRadius: 1 }} />
      </div>

      {/* Name + size */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 12, fontWeight: 500,
          color: mod.enabled ? 'var(--ink)' : 'var(--ink-4)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {mod.displayName}
        </div>
        <div style={{ fontSize: 10, color: 'var(--ink-4)', marginTop: 1 }}>
          {mod.sizeKb >= 1024 ? `${(mod.sizeKb / 1024).toFixed(1)} MB` : `${mod.sizeKb} KB`}
          {!mod.enabled && <span style={{ marginLeft: 6, color: 'var(--gold)' }}>disabled</span>}
        </div>
      </div>

      {/* Toggle */}
      <button
        onClick={onToggle}
        disabled={isBusy}
        title={mod.enabled ? 'Disable' : 'Enable'}
        style={{
          width: 36, height: 20, flexShrink: 0,
          background: mod.enabled ? 'var(--accent)' : 'var(--surface-3)',
          border: `1px solid ${mod.enabled ? 'var(--accent)' : 'var(--border-r)'}`,
          borderRadius: 10,
          cursor: 'pointer',
          position: 'relative',
          transition: 'background 150ms',
        }}
      >
        <div style={{
          position: 'absolute',
          top: 2, left: mod.enabled ? 18 : 2,
          width: 14, height: 14,
          background: '#fff',
          borderRadius: '50%',
          transition: 'left 150ms',
          boxShadow: '0 1px 3px rgba(0,0,0,.3)',
        }} />
      </button>

      {/* Delete */}
      {confirmDelete ? (
        <div style={{ display: 'flex', gap: 4 }}>
          <button
            onClick={() => { setConfirmDelete(false); onDelete() }}
            disabled={isBusy}
            style={{
              fontSize: 11, color: '#fff',
              background: 'var(--lava)', border: 'none',
              borderRadius: 3, padding: '2px 8px', cursor: 'pointer',
            }}
          >
            Delete
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={{
              fontSize: 11, color: 'var(--ink-3)',
              background: 'var(--surface-2)', border: '1px solid var(--border-r)',
              borderRadius: 3, padding: '2px 8px', cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={isBusy}
          title="Delete mod"
          style={{
            width: 24, height: 24, flexShrink: 0,
            background: 'none', border: '1px solid transparent',
            borderRadius: 3, cursor: 'pointer',
            color: 'var(--ink-4)',
            fontSize: 14, lineHeight: 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}
          onMouseEnter={e => { (e.target as HTMLElement).closest('button')!.style.borderColor = 'var(--lava)'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--lava)' }}
          onMouseLeave={e => { (e.target as HTMLElement).closest('button')!.style.borderColor = 'transparent'; (e.target as HTMLElement).closest('button')!.style.color = 'var(--ink-4)' }}
        >
          ✕
        </button>
      )}
    </div>
  )
}
