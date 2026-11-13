'use client'
import { useEffect, useState } from 'react'
import { SWITCHES_KEY, withDefaults, type FeatureKey } from '@/lib/features'

// The on/off switches (lib/features.ts) on screen: fetched once per page load and shared by every component; a change re-renders them all.
let current: Record<FeatureKey, boolean> = withDefaults(null)
let loaded = false
const subs = new Set<(v: Record<FeatureKey, boolean>) => void>()
function load() {
  if (loaded) return
  loaded = true
  fetch(`/api/app-settings?key=${SWITCHES_KEY}`, { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
    current = withDefaults(d?.data?.value ?? d?.value ?? null); subs.forEach(f => f(current))
  }).catch(() => {})
}
export function useFeatures(): Record<FeatureKey, boolean> {
  const [v, setV] = useState(current)
  useEffect(() => { subs.add(setV); load(); setV(current); return () => { subs.delete(setV) } }, [])
  return v
}
// Owner-level only (the server refuses others).
export async function setFeature(key: FeatureKey, on: boolean): Promise<boolean> {
  const next = { ...current, [key]: on }
  const r = await fetch('/api/app-settings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ key: SWITCHES_KEY, value: next }) })
  if (!r.ok) return false
  current = next; subs.forEach(f => f(current)); return true
}
