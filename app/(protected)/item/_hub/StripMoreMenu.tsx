'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The phone's Cash top row: the "More" dropdown. Each entry opens the page of the same name by pressing that tab's (hidden) button in the row;
// CAB has no tab of its own, so it is opened directly. View (Compact / Pictures) sets how the Live items are drawn.
const ITEMS: [string, string][] = [['⏱️', 'Activity times'], ['🔢', 'Counts'], ['👥', 'Customers'], ['🚩', 'Flags'], ['🏭', 'Vendors'], ['📑', 'Purchase Orders'], ['💰', 'P&L']]

export default function StripMoreMenu({ onClose, onCab, showView }: { onClose: () => void; onCab: () => void; showView: boolean }) {
  const [top, setTop] = useState(96)
  const [pics, setPics] = useState(false)
  useEffect(() => {
    setTop(Math.round(document.querySelector('.cash-strip')?.getBoundingClientRect().bottom ?? 96))
    try { setPics(localStorage.getItem('livePictures') === '1') } catch { /* ignore */ }
  }, [])
  const open = (label: string) => { onClose(); document.querySelector<HTMLButtonElement>(`.cash-strip nav button[aria-label="${label}"]`)?.click() }
  const setView = (on: boolean) => { setPics(on); window.dispatchEvent(new CustomEvent('live-pictures', { detail: on })) }
  const row = 'flex w-full items-center gap-2 px-3 py-2 text-left text-[14px] text-white hover:bg-white/10 active:bg-white/20'
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute right-2 w-56 overflow-hidden rounded-xl border border-white/20 bg-[#00072d] shadow-xl" style={{ top }} onClick={e => e.stopPropagation()}>
        {ITEMS.slice(0, 6).map(([icon, label]) => (
          <button key={label} type="button" className={row} onClick={() => open(label)}><span aria-hidden="true" className="w-5 text-center">{icon}</span>{label}</button>
        ))}
        <button type="button" className={row} onClick={() => open('P&L')}><span aria-hidden="true" className="w-5 text-center">💰</span>P&amp;L</button>
        <button type="button" className={row} onClick={() => { onClose(); onCab() }}><span aria-hidden="true" className="w-5 text-center">🏦</span>CAB</button>
        {showView && (
          <div className="border-t border-white/20 px-3 py-2">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-white/60">View</p>
            <div className="grid grid-cols-2 gap-1.5">
              <button type="button" onClick={() => setView(false)} className={`rounded-lg px-2 py-1.5 text-[13px] font-bold ${!pics ? 'bg-white text-[#00072d]' : 'bg-white/10 text-white'}`}>Compact</button>
              <button type="button" onClick={() => setView(true)} className={`rounded-lg px-2 py-1.5 text-[13px] font-bold ${pics ? 'bg-white text-[#00072d]' : 'bg-white/10 text-white'}`}>Pictures</button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body)
}
