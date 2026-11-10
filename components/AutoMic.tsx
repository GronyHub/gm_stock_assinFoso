'use client'
import { usePathname } from 'next/navigation'
import GlobalMic from '@/components/GlobalMic'

// Pages that are not shown inside the hub (Sales, Receipts, Customers...) get the same microphone in the same bottom-right place.
// Inside the hub (/item) and inside its right pane (a frame) the hub's own button is used instead.
export default function AutoMic() {
  const path = usePathname()
  if (path === '/item') return null
  if (typeof window !== 'undefined') { try { if (window.self !== window.top) return null } catch { return null } }
  return <GlobalMic className="bottom-4 right-4" />
}
