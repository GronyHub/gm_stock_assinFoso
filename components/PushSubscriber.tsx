'use client'
import { useEffect } from 'react'

const VAPID_PUBLIC = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function PushSubscriber() {
  useEffect(() => {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

    navigator.serviceWorker.register('/sw.js').then(async reg => {
      // Only subscribe if permission already granted or not yet asked
      if (Notification.permission === 'denied') return

      let existing = await reg.pushManager.getSubscription()
      // One-time renewal per device: a subscription the push service has
      // already expired still looks "existing" to the browser, so it was never
      // replaced and sends to it fail forever. Drop it once and re-subscribe.
      try {
        if (existing && localStorage.getItem('grony_push_renewed_v2') !== '1') {
          await existing.unsubscribe()
          existing = null
        }
        localStorage.setItem('grony_push_renewed_v2', '1')
      } catch { /* private mode etc. -- fall through with what we have */ }
      if (existing) {
        // Re-sync to server in case it was lost
        await syncSub(existing)
        return
      }

      // First visit: ask for permission
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') return

      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      })
      await syncSub(sub)
    }).catch(() => {})
  }, [])

  return null
}

async function syncSub(sub: PushSubscription) {
  const json = sub.toJSON()
  await fetch('/api/push/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ endpoint: json.endpoint, keys: json.keys }),
  }).catch(() => {})
}
