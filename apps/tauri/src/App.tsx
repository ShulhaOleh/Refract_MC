import { useEffect, useState } from 'react'
import { RefreshCw, Check, MemoryStick, Palette } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { configApi, type AppConfig } from './tauri-api'

// POC harness: exercises the Rust `config_get` / `config_set` commands end-to-end
// through shadcn/ui + Tailwind, proving the full Tauri + frontend stack.
export function App() {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function reload() {
    try { setConfig(await configApi.get()); setError(null) }
    catch (e) { setError(String(e)) }
  }

  useEffect(() => { void reload() }, [])

  async function set(key: string, value: unknown) {
    setBusy(true)
    try { setConfig(await configApi.set(key, value)); setError(null) }
    catch (e) { setError(String(e)) }
    finally { setBusy(false) }
  }

  return (
    <div className="min-h-screen p-8">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Refract <span className="text-primary">· Tauri POC</span>
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            shadcn/ui + Tailwind v4, talking to a Rust command over <code className="text-foreground">invoke()</code>.
          </p>
        </div>

        {error && (
          <div className="border-destructive text-destructive rounded-md border bg-destructive/10 px-4 py-2.5 text-sm">
            {error}
          </div>
        )}

        <Card>
          <CardHeader>
            <CardTitle>config.json</CardTitle>
            <CardDescription>
              Read &amp; written by Rust at the same path the Electron app uses.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={reload} disabled={busy}>
                <RefreshCw /> Reload
              </Button>
              <Button size="sm" onClick={() => set('onboardingDone', !config?.onboardingDone)} disabled={busy}>
                <Check /> Toggle onboardingDone
              </Button>
              <Button variant="secondary" size="sm" onClick={() => set('defaultMemoryMb', (Number(config?.defaultMemoryMb) || 2048) + 1024)} disabled={busy}>
                <MemoryStick /> +1024 MB
              </Button>
              <Button variant="secondary" size="sm" onClick={() => set('activeThemeId', config?.activeThemeId === 'dark' ? 'light' : 'dark')} disabled={busy}>
                <Palette /> Flip theme
              </Button>
            </div>

            <pre className="bg-muted text-muted-foreground max-h-[50vh] overflow-auto rounded-lg p-4 font-mono text-xs leading-relaxed">
              {config ? JSON.stringify(config, null, 2) : 'Loading…'}
            </pre>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
