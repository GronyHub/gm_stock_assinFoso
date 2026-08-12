import { useEffect, useRef } from 'react'

/**
 * Repeatedly calls `callback` every `intervalMs`, without resetting the
 * interval when `callback` itself changes identity (avoids re-render churn).
 * Pass `enabled = false` to pause polling (e.g. while the user is mid-edit).
 *
 * Ticks are skipped entirely while the tab is hidden/backgrounded -- a
 * forgotten tab left open all day was hitting the database every few
 * seconds indefinitely, which kept Neon's auto-suspending compute
 * permanently awake (billed the whole time, not just while someone was
 * actually looking at the screen). Regaining visibility fires one
 * immediate catch-up call instead of waiting up to `intervalMs`.
 */
export function usePolling(callback: () => void, intervalMs = 30000, enabled = true) {
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (!enabled) return

    function tick() {
      if (document.visibilityState === 'visible') cbRef.current()
    }
    const id = setInterval(tick, intervalMs)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') cbRef.current()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [intervalMs, enabled])
}
