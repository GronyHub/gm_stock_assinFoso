'use client'
import ScanButton from '@/components/ScanButton'
import GlobalMic from '@/components/GlobalMic'
import { fillSearchBox } from '@/lib/voiceCommands'
import type { HubCtx } from './useHubState'

// Phone only. The camera (scan a barcode) sits inside the search box, like the shopping apps; the microphone (speak a sale
// or a search) sits beside it. Both behave like the floating buttons in HubScrollArea (the desktop copy).
function onLiveNow(h: HubCtx) {
  return h.outerTab === 'loss' && h.lossView === 'items' && h.liveSaleType !== 'GMC' && !h.embedUrl && !h.personal
}

export function HubPhoneCamera({ h }: { h: HubCtx }) {
  const { setScanItem, setScanSignal, embedRef, showToast } = h
  return (
    <ScanButton inline plain onItem={it => {
      if (onLiveNow(h)) { setScanItem(it); setScanSignal(n => n + 1); return }
      const ev = { item: { id: it.id, name: it.name }, handled: false }
      window.dispatchEvent(new CustomEvent('scan-item', { detail: ev }))
      if (ev.handled) return
      let doc: Document | null = null; try { doc = embedRef.current?.contentDocument ?? null } catch { /* ignore */ }
      if (!fillSearchBox(doc ?? document, it.name)) showToast(`Scanned: ${it.name} (₵${it.selling_price})`, 'success')
    }} />
  )
}

export default function HubPhoneTools({ h }: { h: HubCtx }) {
  const { setVoiceSaleText, setVoiceSaleSignal, embedRef, voiceDests } = h
  return (
    <GlobalMic inline frame={embedRef} dests={voiceDests}
      onVoiceSale={onLiveNow(h) ? (t: string) => { setVoiceSaleText(t); setVoiceSaleSignal(n => n + 1) } : undefined} />
  )
}
