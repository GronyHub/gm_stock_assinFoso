'use client'

// Makes the app lighter on the server and quicker on the phone, without changing what any page asks for:
//  1. Identical GET requests to our own API that are in flight at the same moment share one answer (the app used to ask for settings six times at once).
//  2. Counts and background lists that nothing on screen is waiting for (alias checks, loss summaries, law videos, the activity feed...) start a few seconds after the page
//     appears instead of in the same burst as the sale buttons, so the first taps are not queued behind them.
// Anything that is not a plain GET, and everything the first screen needs (items, sales, permissions, menu settings), goes straight through.

const LOW = /^\/api\/(aliases\/|losses\/|law-video|law-reminders|logs\/recent|stock\/(daily|gmc-weekly|overdue)|items\/(sale-history|gmc-target-stock)|reminders\/|push\/heartbeat|due-now|pending-jobs\/payments|violations\/assignments)/
const LOW_DELAY_MS = 3500

declare global { interface Window { __fetchBoost?: boolean } }

if (typeof window !== 'undefined' && !window.__fetchBoost) {
  window.__fetchBoost = true
  const orig = window.fetch.bind(window)
  const inflight = new Map<string, Promise<Response>>()
  const started = Date.now()
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    try {
      const isReq = typeof Request !== 'undefined' && input instanceof Request
      const method = (init?.method ?? (isReq ? (input as Request).method : 'GET')).toUpperCase()
      const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : isReq ? (input as Request).url : ''
      const u = new URL(raw, window.location.href)
      if (method !== 'GET' || u.origin !== window.location.origin || !u.pathname.startsWith('/api/') || init?.body || init?.signal) return orig(input, init)
      const key = u.pathname + u.search
      const shared = inflight.get(key)
      if (shared) return shared.then(r => r.clone())
      const wait = LOW.test(u.pathname) ? Math.max(0, LOW_DELAY_MS - (Date.now() - started)) : 0
      const p = (wait ? new Promise<void>(res => setTimeout(res, wait)) : Promise.resolve()).then(() => orig(input, init))
      inflight.set(key, p)
      p.finally(() => { if (inflight.get(key) === p) inflight.delete(key) }).catch(() => {})
      return p.then(r => r.clone())
    } catch {
      return orig(input, init)
    }
  }
}

export default function FetchBoost() { return null }
