'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

type State = 'checking' | 'on' | 'off' | 'blocked' | 'unsupported' | 'needs-install'

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

const isIOS = () => typeof navigator !== 'undefined' && (/iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))
const isStandalone = () => typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as unknown as { standalone?: boolean }).standalone === true)
const platformName = () => (isIOS() ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'Computer') + (isStandalone() ? ' (installed app)' : ' (browser)')

function deviceId() {
  try {
    let id = localStorage.getItem('grony_device_id')
    if (!id) { id = (crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`); localStorage.setItem('grony_device_id', id) }
    return id
  } catch { return 'unknown' }
}

async function syncSub(sub: PushSubscription) {
  const json = sub.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  }).catch(() => {})
}

// Keeps this device's notifications working: on every open (and whenever the app comes back to the front) it
// checks the permission and the subscription, renews them if they lapsed, and tells the server how it stands.
// When something can't be fixed silently (blocked, not turned on, not installed on iPhone) it shows a banner.
export default function PushSubscriber() {
  const [state, setState] = useState<State>('checking')
  const [help, setHelp] = useState(false)
  const [hidden, setHidden] = useState(false)
  const running = useRef(false)

  const check = useCallback(async (askPermission: boolean) => {
    if (running.current) return
    running.current = true
    let result = 'unsupported' as State
    let endpoint: string | undefined
    try {
      if (isIOS() && !isStandalone()) result = 'needs-install'
      else if (!('serviceWorker' in navigator) || !('PushManager' in window) || typeof Notification === 'undefined') result = 'unsupported'
      else {
        const reg = await navigator.serviceWorker.register('/sw.js')
        if (Notification.permission === 'denied') result = 'blocked'
        else if (!VAPID_PUBLIC) result = 'unsupported'
        else {
          let perm: NotificationPermission = Notification.permission
          // Android / computers may be asked straight away; iPhone only accepts the question after a tap.
          if (perm === 'default' && (askPermission || !isIOS())) perm = await Notification.requestPermission()
          if (perm === 'denied') result = 'blocked'
          else if (perm !== 'granted') result = 'off'
          else {
            const serverKey = urlBase64ToUint8Array(VAPID_PUBLIC)
            let sub = await reg.pushManager.getSubscription()
            if (sub) {
              const cur = sub.options?.applicationServerKey
              const sameKey = !!cur && new Uint8Array(cur).length === serverKey.length && new Uint8Array(cur).every((v, i) => v === serverKey[i])
              if (!sameKey) { await sub.unsubscribe().catch(() => {}); sub = null }
            }
            if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: serverKey })
            await syncSub(sub)
            endpoint = sub.endpoint
            result = 'on'
          }
        }
      }
    } catch { /* leave result as is; reported below */ }
    setState(result)
    // Tell the server how this device stands (at most every 30 min while nothing changes).
    try {
      const last = JSON.parse(localStorage.getItem('grony_push_beat') ?? '{}') as { t?: number; s?: string }
      if (result !== 'checking' && (last.s !== result || Date.now() - (last.t ?? 0) > 30 * 60 * 1000)) {
        await fetch('/api/push/heartbeat', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: deviceId(), status: result, platform: platformName(), endpoint }),
        })
        localStorage.setItem('grony_push_beat', JSON.stringify({ t: Date.now(), s: result }))
      }
    } catch { /* offline: next time */ }
    running.current = false
  }, [])

  useEffect(() => {
    try { setHidden(localStorage.getItem('grony_push_banner_hidden') === new Date().toISOString().slice(0, 10)) } catch { /* ignore */ }
    void check(false)
    let lastRun = Date.now()
    const again = () => { if (document.visibilityState === 'visible' && Date.now() - lastRun > 5 * 60 * 1000) { lastRun = Date.now(); void check(false) } }
    document.addEventListener('visibilitychange', again)
    window.addEventListener('focus', again)
    window.addEventListener('online', again)
    return () => { document.removeEventListener('visibilitychange', again); window.removeEventListener('focus', again); window.removeEventListener('online', again) }
  }, [check])

  if (state === 'on' || state === 'checking' || hidden) return null
  if (state === 'unsupported' && !isIOS()) return null // an old browser: nothing the user can do

  const ios = isIOS()
  const android = typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent)
  const title = state === 'blocked' ? 'Notifications are blocked on this phone'
    : state === 'needs-install' ? 'Add Grony to your home screen to get notifications'
    : state === 'off' ? 'Notifications are off on this phone'
    : 'Notifications are not available in this browser'
  const steps: string[] = state === 'needs-install'
    ? ['Open this page in Safari.', 'Tap the Share button, then "Add to Home Screen".', 'Open Grony from the new home screen icon, then tap "Turn on notifications".']
    : state === 'blocked'
      ? (ios
        ? ['Open the iPhone Settings app.', 'Tap Notifications, then Grony.', 'Turn on "Allow Notifications".']
        : android
          ? ['Tap the lock icon next to the address (or the three dots, Settings, Site settings, Notifications).', 'Set Notifications to Allow.', 'Come back here: this banner disappears by itself.']
          : ['Click the lock icon next to the address.', 'Set Notifications to Allow, then reload the page.'])
      : ['Tap "Turn on notifications" and choose Allow.']

  return (
    <div className="print:hidden fixed inset-x-0 top-0 z-[300] bg-red-600 px-3 py-2 text-white shadow-lg">
      <div className="mx-auto flex max-w-3xl items-center gap-2">
        <p className="flex-1 text-xs font-bold">🔕 {title}</p>
        {state === 'off' && (
          <button type="button" onClick={() => void check(true)} className="rounded-lg bg-white px-3 py-1 text-xs font-bold text-red-700">Turn on notifications</button>
        )}
        <button type="button" onClick={() => setHelp(v => !v)} className="rounded-lg bg-red-800 px-2 py-1 text-xs font-bold">{help ? 'Hide' : 'How to fix'}</button>
        <button type="button" aria-label="Hide for today" title="Hide for today"
          onClick={() => { setHidden(true); try { localStorage.setItem('grony_push_banner_hidden', new Date().toISOString().slice(0, 10)) } catch { /* ignore */ } }}
          className="px-1 text-lg leading-none">&times;</button>
      </div>
      {help && (
        <div className="mx-auto mt-2 max-w-3xl rounded-lg bg-red-700 p-2 text-xs">
          <ol className="list-decimal space-y-0.5 pl-4">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
          <p className="mt-1.5 font-semibold">To keep them on: set the phone&apos;s battery use for this app to &quot;Unrestricted&quot; (Android) and switch off &quot;Pause app activity if unused&quot;.</p>
        </div>
      )}
    </div>
  )
}
