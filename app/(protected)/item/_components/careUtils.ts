'use client'
import { useCallback, useEffect, useState } from 'react'
import type { CareEvent } from '@/lib/caretakerShared'

export const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
}

// Phone photos run to many MB -- downscale before upload (weak mobile data).
export async function compressPhoto(file: File): Promise<File> {
  if (!file.type.startsWith('image/') || file.size <= 600 * 1024) return file
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 1280 / Math.max(bmp.width, bmp.height))
    const c = document.createElement('canvas')
    c.width = Math.round(bmp.width * scale); c.height = Math.round(bmp.height * scale)
    const ctx = c.getContext('2d')
    if (!ctx) { bmp.close(); return file }
    ctx.drawImage(bmp, 0, 0, c.width, c.height); bmp.close()
    const blob = await new Promise<Blob | null>(r => c.toBlob(r, 'image/jpeg', 0.72))
    return blob ? new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' }) : file
  } catch { return file }
}

export async function uploadCarePhoto(file: File): Promise<string> {
  const fd = new FormData()
  fd.append('file', await compressPhoto(file))
  const res = await fetch('/api/caretaker/upload', { method: 'POST', body: fd })
  const d = await res.json().catch(() => ({}))
  if (!res.ok || !d.url) throw new Error(d.error ?? 'Photo upload failed')
  return d.url as string
}

export async function postCareEvent(ev: { child?: string | null; kind: string; value?: string | null; note?: string | null; photo_url?: string | null; extra?: Record<string, unknown> }): Promise<CareEvent> {
  let lastErr = 'Could not save'
  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch('/api/caretaker/events', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ev) })
      const d = await res.json().catch(() => ({}))
      if (res.ok) return d as CareEvent
      lastErr = d.error ?? lastErr
      if (res.status < 500) break // a rejected record won't succeed on retry
    } catch { /* network -- retry */ }
    await new Promise(r => setTimeout(r, 800 * (i + 1)))
  }
  throw new Error(lastErr)
}

// Loads one day's records and keeps them fresh (refresh() after each save).
export function useCareEvents(date: string, pollMs = 60000) {
  const [events, setEvents] = useState<CareEvent[]>([])
  const [error, setError] = useState(false)
  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/caretaker/events?date=${date}`)
      const d = await res.json()
      if (res.ok && Array.isArray(d)) { setEvents(d); setError(false) } else setError(true)
    } catch { setError(true) }
  }, [date])
  useEffect(() => {
    void refresh()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void refresh() }, pollMs)
    return () => clearInterval(t)
  }, [refresh, pollMs])
  return { events, error, refresh, setEvents }
}

// The four child tiles live in the left pane (CareChildTiles); tapping one asks
// Care Today to open that child's page. `pending` covers the case where Care
// Today is not on screen yet and mounts a moment later.
declare global { interface Window { __careOpenChild?: string } }
export function requestOpenChild(name: string) {
  window.__careOpenChild = name
  window.dispatchEvent(new CustomEvent('care-open-child', { detail: name }))
}
