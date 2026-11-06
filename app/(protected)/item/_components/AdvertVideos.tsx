'use client'
import { useEffect, useMemo, useState } from 'react'

type Ad = { key: string; file: string; title: string; icon: string; pitch: string; words: string[] }
const ADS: Ad[] = [
  { key: 'main', file: 'Grony_Ad_main.mp4', title: 'Everything in one place', icon: '🌟', pitch: 'printing, computers, software, photo, sound and video', words: [] },
  { key: 'computers', file: 'Grony_Ad_computers.mp4', title: 'Computers, Accessories & Repairs', icon: '💻', pitch: 'computers, accessories and repairs', words: ['computer', 'laptop', 'keyboard', 'mouse', 'accessor', 'charger', 'cable', 'batter', 'connector', 'converter', 'gamepad', 'speaker', 'hardware'] },
  { key: 'training', file: 'Grony_Ad_training.mp4', title: 'Computer Training', icon: '🎓', pitch: 'computer training', words: ['training', 'computer', 'internet'] },
  { key: 'printing', file: 'Grony_Ad_printing.mp4', title: 'Printing Press & Internet Cafe', icon: '🖨️', pitch: 'printing, photocopy, scanning and internet cafe', words: ['print', 'photo', 'large format', 'internet', 'scan', 'copy', 'passport'] },
  { key: 'materials', file: 'Grony_Ad_materials.mp4', title: 'Printing Materials, Toner & Ink', icon: '🖋️', pitch: 'printing materials, toner and ink', words: ['ink', 'toner', 'paper', 'envelope', 'drum', 'material', 'blade'] },
  { key: 'software', file: 'Grony_Ad_software.mp4', title: 'Software & App Development', icon: '📱', pitch: 'software and mobile app development', words: ['software', 'app', 'development'] },
  { key: 'website', file: 'Grony_Ad_website.mp4', title: 'Website Design & Hosting', icon: '🌐', pitch: 'website design and hosting', words: ['web', 'hosting', 'software', 'internet'] },
  { key: 'media', file: 'Grony_Ad_media.mp4', title: 'Photo, Sound & Video Production', icon: '🎬', pitch: 'photo, sound and video production', words: ['photo', 'video', 'sound', 'audio', 'music', 'camera', 'advert'] },
  { key: 'hiring', file: 'Grony_Ad_hiring.mp4', title: 'Hiring Services', icon: '🤝', pitch: 'hiring services', words: ['hir'] },
]
type Cust = { id: number; display_name: string; first_name?: string | null; phone: string | null; customer_id_code: string | null; service_goods: string | null }
const wa = (phone: string) => { const d = phone.replace(/\D/g, ''); return d.startsWith('233') ? d : d.startsWith('0') ? '233' + d.slice(1) : '233' + d }
const SHOP = 'Grony Multimedia, between GCB & ADB Bank, Assin Foso. Call / WhatsApp / MoMo: 053 432 8977'

// Staff: play each advert, send it to saved customers (by the services they use) on WhatsApp, and post it to the
// shop's social pages. The videos are plain files in /public/adverts, loaded only when someone presses play.
export default function AdvertVideos() {
  const [open, setOpen] = useState<string | null>(null)
  const [custs, setCusts] = useState<Cust[] | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [sent, setSent] = useState<Record<string, boolean>>({})
  const [msg, setMsg] = useState('')
  useEffect(() => { try { setSent(JSON.parse(localStorage.getItem('gm_ad_sent') ?? '{}')) } catch { /* ignore */ } }, [])
  const ad = ADS.find(a => a.key === open) ?? null
  useEffect(() => {
    if (!ad || custs) return
    fetch('/api/customers').then(r => r.json()).then(d => setCusts(Array.isArray(d) ? d : [])).catch(() => setCusts([]))
  }, [ad, custs])
  const url = (a: Ad) => `${typeof window !== 'undefined' ? window.location.origin : 'https://app.gronymultimedia.com'}/adverts/${a.file}`
  const text = (a: Ad, name?: string) => `Hello${name ? ' ' + name : ''}! Grony Multimedia offers ${a.pitch}. Watch our short video: ${url(a)}\n\n${SHOP}`
  const matches = useMemo(() => {
    if (!ad || !custs) return []
    return custs.filter(c => c.phone && (showAll || ad.words.length === 0 || ad.words.some(w => (c.service_goods ?? '').toLowerCase().includes(w))))
  }, [ad, custs, showAll])

  function mark(a: Ad, c: Cust) { const n = { ...sent, [`${a.key}:${c.id}`]: true }; setSent(n); try { localStorage.setItem('gm_ad_sent', JSON.stringify(n)) } catch { /* ignore */ } }
  async function share(a: Ad) {
    try {
      const blob = await (await fetch(`/adverts/${a.file}`)).blob()
      const file = new File([blob], a.file, { type: 'video/mp4' })
      const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
      if (nav.canShare?.({ files: [file] })) { await nav.share({ files: [file], title: a.title, text: text(a) }); return }
      setMsg('Sharing the file is not available on this device. Use Download, then post it from TikTok or Facebook.')
    } catch { /* cancelled */ }
  }

  return (
    <div className="space-y-3 pb-6">
      <p className="text-[11px] text-gray-500">Tap a service to watch its advert. Videos only load when you open them.</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {ADS.map(a => (
          <button key={a.key} type="button" onClick={() => { setOpen(open === a.key ? null : a.key); setMsg('') }}
            className={`flex items-center gap-2 rounded-xl border-2 p-2 text-left ${open === a.key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 bg-white'}`}>
            <span className="text-3xl">{a.icon}</span><span className="text-xs font-bold leading-tight text-gray-900">{a.title}</span>
          </button>
        ))}
      </div>
      {ad && (
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-3">
          <p className="text-sm font-bold text-gray-900">{ad.icon} {ad.title}</p>
          <div className="flex flex-wrap gap-3">
            <video key={ad.key} src={`/adverts/${ad.file}`} controls playsInline preload="none" className="max-h-[420px] rounded-lg bg-black" />
            <div className="min-w-[200px] flex-1 space-y-2">
              <p className="text-xs font-bold uppercase text-gray-500">Post it</p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void share(ad)} className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white">Share (phone)</button>
                <a href={`/adverts/${ad.file}`} download className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-bold text-white">Download</a>
                <a href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url(ad))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-[#1877F2] px-3 py-2 text-xs font-bold text-white">Facebook</a>
                <a href="https://www.tiktok.com/upload" target="_blank" rel="noopener noreferrer" className="rounded-lg bg-black px-3 py-2 text-xs font-bold text-white">TikTok</a>
                <a href={`https://wa.me/?text=${encodeURIComponent(text(ad))}`} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">WhatsApp status / group</a>
              </div>
              <p className="text-[10px] text-gray-500">On a phone, Share opens the video in TikTok, Facebook or WhatsApp. On a computer, Download it, then upload it on the page.</p>
              {msg && <p className="text-xs font-semibold text-red-600">{msg}</p>}
            </div>
          </div>
          <div>
            <p className="text-xs font-bold uppercase text-gray-500">Send to customers on WhatsApp</p>
            <label className="mt-1 flex items-center gap-1.5 text-xs"><input type="checkbox" checked={showAll} onChange={e => setShowAll(e.target.checked)} /> Show every saved customer, not only those who use this service</label>
            {custs === null && <p className="text-xs text-gray-400">Loading customers…</p>}
            {custs && <p className="mt-1 text-[11px] text-gray-500">{matches.length} customer{matches.length === 1 ? '' : 's'} with a phone number{ad.words.length && !showAll ? ' who use this service' : ''}. Tap Send: WhatsApp opens with the message ready; press send in WhatsApp.</p>}
            <div className="mt-1 max-h-72 space-y-1 overflow-y-auto">
              {matches.map(c => {
                const done = sent[`${ad.key}:${c.id}`]
                return (
                  <div key={c.id} className="flex items-center gap-2 rounded-lg border border-gray-100 px-2 py-1.5">
                    <div className="min-w-0 flex-1"><p className="truncate text-xs font-semibold text-gray-900">{c.display_name}{c.customer_id_code ? ` · ${c.customer_id_code}` : ''}</p><p className="truncate text-[10px] text-gray-500">{c.phone}{c.service_goods ? ` · ${c.service_goods}` : ''}</p></div>
                    <a href={`https://wa.me/${wa(c.phone!)}?text=${encodeURIComponent(text(ad, (c.first_name || c.display_name || '').split(' ')[0]))}`} target="_blank" rel="noopener noreferrer" onClick={() => mark(ad, c)}
                      className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold ${done ? 'bg-gray-200 text-gray-600' : 'bg-green-600 text-white'}`}>{done ? 'Sent ✓' : 'Send'}</a>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
