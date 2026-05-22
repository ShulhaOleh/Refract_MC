import { useRouterState } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { BellIcon } from '../ui/BlockIcons'

const CRUMBS: Record<string, string> = {
  '/':           'Instance Library',
  '/browse/':    'Browse Mods',
  '/modpacks/':  'Modpacks',
  '/account/':   'Account',
  '/settings/':  'Settings',
}

const traffic: Array<{ color: string; action: () => void }> = [
  { color: '#ff5f57', action: () => api.window.close()    },
  { color: '#febc2e', action: () => api.window.minimize() },
  { color: '#28c840', action: () => api.window.maximize() },
]

export function TitleBar() {
  const pathname = useRouterState({ select: s => s.location.pathname })
  const crumb = CRUMBS[pathname] ?? ''

  return (
    <div
      className="drag-region"
      style={{
        gridColumn: '1 / -1',
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px',
        background: 'var(--sb)',
        borderBottom: '1px solid var(--line)',
        color: 'var(--ink-3)',
        fontSize: 11.5, fontWeight: 500, letterSpacing: '.01em',
        userSelect: 'none',
      }}
    >
      {/* macOS-style traffic lights */}
      <div className="no-drag-region" style={{ display:'flex', gap:8, alignItems:'center' }}>
        {traffic.map((t, i) => (
          <button key={i} onClick={t.action} style={{ width:11, height:11, borderRadius:'50%', background:t.color, border:'1px solid rgba(0,0,0,.4)', cursor:'default', padding:0, flexShrink:0 }} />
        ))}
      </div>

      {/* Logo + breadcrumb */}
      <div style={{ marginLeft:12, display:'flex', alignItems:'center', gap:8 }}>
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="-110 -110 220 220" width={16} height={16} style={{ flexShrink:0 }}>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#5316D4"/>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#3D0FA3" transform="rotate(30)"/>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#8A52FF" transform="rotate(60)"/>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#3D0FA3" transform="rotate(90)"/>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#5316D4" transform="rotate(120)"/>
          <polygon points="0,-92 14,0 0,92 -14,0" fill="#8A52FF" transform="rotate(150)"/>
          <circle r="24" fill="#1B044F"/>
          <circle r="6" fill="#ECE4FF"/>
        </svg>
        <b style={{ color:'var(--ink)', fontWeight:600 }}>Refract</b>
        {crumb && <span style={{ color:'var(--ink-3)' }}>/ {crumb}</span>}
      </div>

      <div style={{ flex:1 }} />

      <div className="no-drag-region" style={{ display:'flex', gap:4, color:'var(--ink-3)' }}>
        <div style={{ width:26, height:26, borderRadius:4, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <BellIcon />
        </div>
      </div>
    </div>
  )
}
