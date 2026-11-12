'use client'
import { useEffect, useState } from 'react'
import { shortTitle } from '@/lib/dailyChecksShared'

// One task shown as a small text tile. Compact (six to a row): the time, the short name and who. Full (two to a row): the whole text, who it falls on,
// the law's category and its type. A mark in the corner says how it ended: green tick = done, red cross = not done at all, dash = marked not done with a reason.
export type TileDensity = 'compact' | 'full'
export const tileGrid = (d: TileDensity) => (d === 'full' ? 'grid grid-cols-2 gap-1.5' : 'grid grid-cols-6 gap-1')

export function useTileDensity(): [TileDensity, (d: TileDensity) => void] {
  const [d, setD] = useState<TileDensity>('compact')
  useEffect(() => { try { if (localStorage.getItem('tileDensity') === 'full') setD('full') } catch { /* default */ } }, [])
  return [d, (v: TileDensity) => { setD(v); try { localStorage.setItem('tileDensity', v) } catch { /* ignore */ } }]
}

export function DensityToggle({ density, onChange }: { density: TileDensity; onChange: (d: TileDensity) => void }) {
  return (
    <button type="button" onClick={() => onChange(density === 'full' ? 'compact' : 'full')} title={density === 'full' ? 'Show small tiles' : 'Show the whole text on each tile'}
      className="shrink-0 rounded-lg border border-gray-300 bg-white px-1.5 py-1.5 text-[10px] font-bold text-gray-700">{density === 'full' ? '▦ Small' : '▤ Full'}</button>
  )
}

export default function TaskTile({ density, time, title, who, category, type, detail, tone, mark, badge, icon, onClick, lawHref }: {
  density: TileDensity; time?: string | null; title: string; who?: string | null; category?: string | null; type?: string | null; detail?: string | null
  tone: string; mark?: 'done' | 'miss' | 'no'; badge?: number; icon?: string; onClick?: () => void
  lawHref?: string // owner/manager only: a small link on the tile to the law behind it (change how often it repeats, restructure it)
}) {
  const full = density === 'full'
  const markEl = mark && (
    <span className={`absolute right-1 top-0 font-black leading-none ${full ? 'text-base' : 'text-[12px]'} ${mark === 'done' ? 'text-green-600' : mark === 'miss' ? 'text-red-600' : 'text-gray-500'}`}
      title={mark === 'done' ? 'Done' : mark === 'miss' ? 'Not done at all' : 'Marked not done, with a reason'}>{mark === 'done' ? '✓' : mark === 'miss' ? '✗' : '–'}</span>)
  const tile = (
    <button type="button" title={title} onClick={onClick} onContextMenu={e => e.preventDefault()}
      className={`relative flex select-none flex-col items-start justify-start gap-px rounded-md border text-left active:opacity-70 ${full ? 'min-h-[4.5rem] px-2 py-1.5' : 'min-h-[3.6rem] px-1 py-0.5'} ${tone}`}>
      {markEl}
      <span className={`flex items-center gap-1 font-extrabold leading-none text-gray-500 ${full ? 'text-[11px]' : 'text-[8px]'}`}>{icon && full ? <span className="text-base">{icon}</span> : null}{time}{badge && badge > 1 ? <span className="rounded-full bg-[#14213D] px-1 text-[9px] text-white">{badge}</span> : null}</span>
      <span className={`break-words font-semibold text-gray-900 ${full ? 'text-[12px] leading-snug' : 'line-clamp-3 text-[8px] leading-[1.1]'}`}>{full ? title : shortTitle(title)}</span>
      {full && detail ? <span className="text-[11px] leading-snug text-gray-600">{detail}</span> : null}
      {full && (category || type) ? <span className="text-[10px] font-semibold leading-tight text-gray-500">{[category, type].filter(Boolean).join(' · ')}</span> : null}
      {who ? <span className={`mt-auto w-full font-bold leading-tight text-indigo-800 ${full ? 'truncate pt-0.5 text-[11px]' : 'truncate text-[7px]'}`}>{who}</span> : null}
    </button>
  )
  if (!lawHref) return tile
  return (
    <div className="relative flex flex-col [&>button]:flex-1">{tile}
      <a href={lawHref} title="Open the law behind this task to change it" onClick={e => e.stopPropagation()}
        className={`absolute bottom-0 right-0 rounded-tl-md rounded-br-md bg-blue-600 font-extrabold leading-none text-white ${full ? 'px-1.5 py-1 text-[10px]' : 'px-1 py-0.5 text-[8px]'}`}>Law</a>
    </div>
  )
}
