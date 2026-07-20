'use client'
import { useState } from 'react'
import ContentPage from './ContentPage'
import ClosingReportLogView from './ClosingReportLogView'

type AdvertView = 'audio' | 'photoshop' | 'whatsapp' | 'cuttings' | 'video' | 'log'

const SUBMENU: { key: AdvertView; label: string }[] = [
  { key: 'audio', label: 'Audio' },
  { key: 'photoshop', label: 'Photoshop' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'cuttings', label: 'Cuttings' },
  { key: 'video', label: 'Video' },
  { key: 'log', label: 'Daily Log' },
]

// Grony Manage > Advert -- mirrors the shop's Google Drive advert folder
// structure (1) ADVO - Advert 1..5), so each sub-tab holds the rules for
// that advert category. "Daily Log" is the existing feature that tracks
// whether the roadside advert was actually played each day.
export default function AdvertTab() {
  const [view, setView] = useState<AdvertView>('audio')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-0.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
        {SUBMENU.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`shrink-0 text-xs font-semibold px-2 py-0.5 rounded-lg whitespace-nowrap transition
              ${view === v.key ? 'bg-blue-600 text-white' : 'text-gray-500 hover:bg-gray-100'}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'audio' && <ContentPage contentKey="advert_audio_roadside" title="Advert 1 — Audio (for Roadside)" />}
        {view === 'photoshop' && <ContentPage contentKey="advert_photo_photoshop" title="Advert 2 — Photo (Photoshop Files)" />}
        {view === 'whatsapp' && <ContentPage contentKey="advert_photo_whatsapp" title="Advert 3 — Photo (WhatsApp Advert)" />}
        {view === 'cuttings' && <ContentPage contentKey="advert_photo_cuttings" title="Advert 4 — Photo (Cuttings)" />}
        {view === 'video' && <ContentPage contentKey="advert_video" title="Advert 5 — Video Advert" />}
        {view === 'log' && <ClosingReportLogView field="advert_played" label="Advert" icon="📢" />}
      </div>
    </div>
  )
}
