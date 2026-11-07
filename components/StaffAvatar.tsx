'use client'
import { useEffect, useState } from 'react'

// Round staff photo, or a coloured circle with their initials when they have not added one yet.
const COLOURS = ['bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-rose-500', 'bg-violet-500', 'bg-cyan-600', 'bg-orange-500', 'bg-teal-600']

export default function StaffAvatar({ name, url, size = 24, className = '' }: { name: string; url?: string | null; size?: number; className?: string }) {
  const [broken, setBroken] = useState(false)
  useEffect(() => setBroken(false), [url])
  const initials = (name || '?').trim().split(/\s+/).map(w => w[0]).join('').slice(0, 2).toUpperCase()
  const colour = COLOURS[[...(name || '?').toLowerCase()].reduce((a, c) => a + c.charCodeAt(0), 0) % COLOURS.length]
  const box = { width: size, height: size, fontSize: Math.max(8, Math.round(size * 0.4)) }
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt={name} style={box} onError={() => setBroken(true)} className={`shrink-0 rounded-full object-cover border border-white/60 ${className}`} />
  }
  return <span style={box} className={`shrink-0 rounded-full inline-flex items-center justify-center font-bold text-white ${colour} ${className}`}>{initials}</span>
}

// The signed-in person's own photo. Fetched once and shared; the profile page announces changes with the
// 'gm-photo-changed' event so every avatar on screen updates straight away.
let mine: { name: string; url: string | null } | null = null
let pending: Promise<void> | null = null
function loadMine() {
  if (!pending) pending = fetch('/api/profile').then(r => r.ok ? r.json() : null).then(d => {
    if (d) mine = { name: d.display_name || d.username || '', url: d.photo_url ?? null }
  }).catch(() => {}).finally(() => { pending = null })
  return pending
}
export function announcePhotoChange(url: string | null) {
  if (mine) mine = { ...mine, url }
  window.dispatchEvent(new CustomEvent('gm-photo-changed', { detail: url }))
}

export function MyAvatar({ size = 22, className = '' }: { size?: number; className?: string }) {
  const [me, setMe] = useState(mine)
  useEffect(() => {
    let live = true
    if (!mine) void loadMine().then(() => { if (live) setMe(mine) })
    const on = () => { if (live) setMe(mine ? { ...mine } : mine) }
    window.addEventListener('gm-photo-changed', on)
    return () => { live = false; window.removeEventListener('gm-photo-changed', on) }
  }, [])
  return <StaffAvatar name={me?.name ?? ''} url={me?.url} size={size} className={className} />
}
