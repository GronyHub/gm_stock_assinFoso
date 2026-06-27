import { useEffect, useRef } from 'react'

const HEARTBEAT_MS = 15000

/**
 * Reports `activity` to /api/presence while the calling component is
 * mounted, refreshing every 15s so it stays "live", and clears it on
 * unmount. If `activity` is falsy, does nothing (e.g. pass null/'' to
 * conditionally disable reporting without unmounting the component).
 */
export function usePresenceReporter(activity: string | null | undefined) {
  const activityRef = useRef(activity)
  activityRef.current = activity

  useEffect(() => {
    if (!activity) return
    let cancelled = false

    function report() {
      if (cancelled || !activityRef.current) return
      fetch('/api/presence', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity: activityRef.current }),
      }).catch(() => {})
    }

    report()
    const id = setInterval(report, HEARTBEAT_MS)

    return () => {
      cancelled = true
      clearInterval(id)
      fetch('/api/presence', { method: 'DELETE' }).catch(() => {})
    }
  }, [activity])
}
