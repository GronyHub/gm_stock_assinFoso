import { useEffect, useRef } from 'react'

const HEARTBEAT_MS = 15000

/**
 * Reports `activity` to /api/presence while the calling component is
 * mounted, refreshing every 15s so it stays "live", and clears it on
 * unmount. If `activity` is falsy, does nothing (e.g. pass null/'' to
 * conditionally disable reporting without unmounting the component).
 *
 * Heartbeats are skipped entirely while the tab is hidden/backgrounded --
 * same reasoning as usePolling's own visibility guard (see its comment): a
 * forgotten tab left open all day was firing this every 15s indefinitely
 * regardless of whether anyone was actually looking at it, which is both
 * wasted request/observability volume and a misleading "still live" signal
 * for a page nobody's actually on. Regaining visibility fires one
 * immediate catch-up heartbeat instead of waiting up to 15s. The
 * unmount/DELETE cleanup stays unconditional -- presence should still
 * clear correctly if someone navigates away while the tab happens to be
 * hidden.
 */
export function usePresenceReporter(activity: string | null | undefined) {
  const activityRef = useRef(activity)
  activityRef.current = activity

  useEffect(() => {
    if (!activity) return
    let cancelled = false

    function report() {
      if (cancelled || !activityRef.current) return
      if (document.visibilityState !== 'visible') return
      fetch('/api/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: activityRef.current }),
      }).catch(() => {})
    }

    report()
    const id = setInterval(report, HEARTBEAT_MS)

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') report()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      cancelled = true
      clearInterval(id)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      fetch('/api/presence', { method: 'DELETE' }).catch(() => {})
    }
  }, [activity])
}
