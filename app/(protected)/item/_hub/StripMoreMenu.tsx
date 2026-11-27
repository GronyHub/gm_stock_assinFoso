'use client'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'

// The phone's Cash top row: the tabs staff do not have to visit (the ones a law pushes onto Waiting) wait in this "More" dropdown. Each entry opens the page of the same
// name by pressing that tab's (hidden) button in the row. An entry whose tab is not there right now (for example Net Loss with nothing in it) is left out.
const ITEMS: [string, string][] = [
  ['🔢', 'Counts'], ['👥', 'Customers'], ['🏭', 'Vendors'], ['⏱️', 'Activity times'], ['•', 'Cost ≥ Selling Price'], ['🚩', 'Flags'],
]
export const MORE_LABELS = ITEMS.map(i => i[1])

export default function StripMoreMenu({ onClose, showView }: { onClose: () => void; showView: boolean }) {
  const [top, setTop] = useState(96)
  const [pics, setPics] = useState(false)
  const [present, setPresent] = useState<Set<string>>(new Set())
  useEffect(() => {
    setTop(Math.round(document.querySelector('.cash-strip')?.getBoundingClientRect().bottom ?? 96))
    try { setPics(localStorage.getItem('livePictures') === '1') } catch { /* ignore */ }
    setPresent(new Set(Array.from(document.querySelectorAll<HTMLButtonElement>('.cash-strip nav button[aria-label]')).map(b => b.getAttribute('aria-label') ?? '')))
  }, [])
  const open = (label: string) => { onClose(); document.querySelector<HTMLButtonElement>(`.cash-strip nav button[aria-label="${label}"]`)?.click() }
  const setView = (on: boolean) => { setPics(on); window.dispatchEvent(new CustomEvent('live-pictures', { detail: on })) }
  const row = 'flex w-full items-center gap-2 px-3 py-2.5 text-left text-[14px] text-white hover:bg-white/10 active:bg-white/20'
  if (typeof document === 'undefined') return null
  return createPortal(
    <div className="fixed inset-0 z-[60]" onClick={onClose}>
      <div className="absolute right-2 max-h-[70vh] w-60 overflow-y-auto rounded-xl border border-white/20 bg-[#00072d] shadow-xl" style={{ top }} onClick={e => e.stopPropagation()}>
        {ITEMS.filter(([, label]) => present.has(label)).map(([icon, label]) => (
          <button key={label} type="button" className={row} onClick={() => open(label)}><span aria-hidden="true" className="w-5 text-center">{icon}</span>{label}</button>
        ))}
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
