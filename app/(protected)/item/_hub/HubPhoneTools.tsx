'use client'
import ScanButton from '@/components/ScanButton'
import GlobalMic from '@/components/GlobalMic'
import { fillSearchBox } from '@/lib/voiceCommands'
import type { HubCtx } from './useHubState'

// Phone only: the camera (scan a barcode) and the microphone (speak a sale or a search) sit in the Live / Sales Log toolbar,
// not floating over the tiles. Same behaviour as the floating buttons in HubScrollArea (see there for the desktop copy).
export default function HubPhoneTools({ h }: { h: HubCtx }) {
  const { outerTab, lossView, liveSaleType, embedUrl, personal, setScanItem, setScanSignal, setVoiceSaleText, setVoiceSaleSignal, embedRef, voiceDests, showToast } = h
  const onLive = outerTab === 'loss' && lossView === 'items' && liveSaleType !== 'GMC' && !embedUrl && !personal
  return (<>
    <ScanButton inline onItem={it => {
      if (onLive) { setScanItem(it); setScanSignal(n => n + 1); return }
      const ev = { item: { id: it.id, name: it.name }, handled: false }
      window.dispatchEvent(new CustomEvent('scan-item', { detail: ev }))
      if (ev.handled) return
      let doc: Document | null = null; try { doc = embedRef.current?.contentDocument ?? null } catch { /* ignore */ }
      if (!fillSearchBox(doc ?? document, it.name)) showToast(`Scanned: ${it.name} (₵${it.selling_price})`, 'success')
    }} />
    <GlobalMic inline frame={embedRef} dests={voiceDests}
      onVoiceSale={onLive ? (t: string) => { setVoiceSaleText(t); setVoiceSaleSignal(n => n + 1) } : undefined} />
  </>)
}
