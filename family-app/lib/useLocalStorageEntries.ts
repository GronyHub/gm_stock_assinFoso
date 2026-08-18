'use client'

import { useCallback, useMemo, useSyncExternalStore } from 'react'
import type { LandEntry } from './types'

const listeners = new Map<string, Set<() => void>>()

function emitChange(key: string) {
  listeners.get(key)?.forEach((callback) => callback())
}

function getServerSnapshot() {
  return '[]'
}

export function useLocalStorageEntries(
  key: string
): [LandEntry[], (next: LandEntry[]) => void] {
  const subscribe = useCallback(
    (callback: () => void) => {
      if (!listeners.has(key)) listeners.set(key, new Set())
      listeners.get(key)!.add(callback)
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) callback()
      }
      window.addEventListener('storage', onStorage)
      return () => {
        listeners.get(key)!.delete(callback)
        window.removeEventListener('storage', onStorage)
      }
    },
    [key]
  )

  const getSnapshot = useCallback(() => localStorage.getItem(key) ?? '[]', [key])

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  const entries = useMemo(() => JSON.parse(raw) as LandEntry[], [raw])

  const setEntries = useCallback(
    (next: LandEntry[]) => {
      localStorage.setItem(key, JSON.stringify(next))
      emitChange(key)
    },
    [key]
  )

  return [entries, setEntries]
}
