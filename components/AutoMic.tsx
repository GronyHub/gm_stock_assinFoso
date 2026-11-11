'use client'
import { usePathname } from 'next/navigation'
import GlobalMic from '@/components/GlobalMic'
import ScanButton from '@/components/ScanButton'
import { fillSearchBox } from '@/lib/voiceCommands'
import type { Dest } from '@/lib/voiceCommands'

// Pages that are not shown inside the hub (Sales, Receipts...) get the same microphone in the same bottom-right place.
// Inside the hub (/item) and inside its right pane (a frame) the hub's own button is used instead.
const go = (url: string) => () => { window.location.href = url }
const DESTS: Dest[] = [
  { label: 'Company Laws', names: ['company laws', 'laws'], run: go('/laws') }, { label: 'Waiting for team', names: ['waiting for team', 'daily checklist', 'checklist', 'to do'], run: go('/todo') },
  { label: 'Customers', names: ['customers'], run: go('/item?view=customers') }, { label: 'Live Sale', names: ['live sale', 'items'], run: go('/item') },
  { label: 'Sales Log', names: ['sales log', 'sales'], run: go('/item?view=sales') }, { label: 'Counts', names: ['counts', 'counting'], run: go('/item?view=counts') },
  { label: 'Team Times', names: ['team times', 'times'], run: go('/item?view=teamTimes') }, { label: 'How To', names: ['how to', 'help'], run: go('/how-to') },
  { label: 'Penalties', names: ['penalties', 'penalty points'], run: go('/penalties') },
]
export default function AutoMic() {
  const path = usePathname()
  if (path === '/item') return null
  if (typeof window !== 'undefined') { try { if (window.self !== window.top) return null } catch { return null } }
  return (<>
    <GlobalMic dests={DESTS} className="bottom-4 right-4" />
    {/* The same scan button as in the hub: the scanned item's name goes into this page's search box. */}
    <ScanButton className="bottom-4 right-4 -translate-y-14" onItem={it => { if (!fillSearchBox(document, it.name)) alert(`Scanned: ${it.name} (₵${it.selling_price})`) }} />
  </>)
}
