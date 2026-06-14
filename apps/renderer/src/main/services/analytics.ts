import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { paths } from './paths'
import { getConfig } from './config'

// ── Credentials ────────────────────────────────────────────────────────────
// The Measurement ID is public (it ships in every GA-instrumented client), so
// it's hardcoded. The Measurement Protocol API secret must NOT live in this
// public repo, so it's injected at build time from the GA_API_SECRET env via
// the main-process `define` in electron.vite.config.ts. Until the secret is
// provided the module stays inert (no network calls). The secret only grants
// event ingestion to this one property.
declare const __GA_API_SECRET__: string | undefined

const MEASUREMENT_ID = 'G-MX248BTV0T'
const API_SECRET = typeof __GA_API_SECRET__ === 'string' ? __GA_API_SECRET__ : ''
const ENDPOINT = `https://www.google-analytics.com/mp/collect?measurement_id=${MEASUREMENT_ID}&api_secret=${API_SECRET}`

// The Measurement ID is always present; analytics only "go live" once the
// build-injected API secret is set.
const configured = (): boolean => API_SECRET !== ''
// Opt-out: analytics runs unless the user explicitly disabled it.
const consented = (): boolean => getConfig().analyticsEnabled !== false

type EventParams = Record<string, string | number>

// A stable, anonymous per-install id (a random UUID — not tied to any account,
// device fingerprint, or PII). Persisted next to the other app data.
let clientId = ''
const sessionId = String(Date.now())

function clientIdFile(): string { return join(paths.userData, 'analytics.json') }

function loadClientId(): string {
  try {
    const data = JSON.parse(readFileSync(clientIdFile(), 'utf-8')) as { clientId?: string }
    if (data.clientId) return data.clientId
  } catch { /* fall through to generate */ }
  const id = randomUUID()
  try { writeFileSync(clientIdFile(), JSON.stringify({ clientId: id }), 'utf-8') } catch { /* best-effort */ }
  return id
}

/** Initialise analytics and record the app_open event. Safe to call always. */
export function initAnalytics(): void {
  if (!configured()) return
  clientId = loadClientId()
  trackEvent('app_open')
}

/**
 * Send a GA4 event. No-op unless analytics is both configured and consented.
 * Only pass non-identifying parameters — never usernames, UUIDs, tokens, or
 * file paths.
 */
export function trackEvent(name: string, params: EventParams = {}): void {
  if (!configured() || !consented()) return
  if (!clientId) clientId = loadClientId()

  const body = JSON.stringify({
    client_id: clientId,
    events: [{
      name,
      params: {
        // session_id + engagement_time_msec are what make GA4 count the event
        // as an active session (otherwise Realtime/engagement stay empty).
        session_id: sessionId,
        engagement_time_msec: 100,
        app_version: app.getVersion(),
        os: process.platform,
        ...params,
      },
    }],
  })

  // Fire-and-forget. Telemetry must never surface an error to the user, and we
  // deliberately don't log failures here (the logger forwards errors back into
  // analytics, which would recurse).
  void fetch(ENDPOINT, { method: 'POST', body }).catch(() => { /* ignore */ })
}
