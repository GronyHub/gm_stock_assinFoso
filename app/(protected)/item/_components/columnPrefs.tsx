'use client'
import { useState, useEffect, useRef } from 'react'

// Reusable "Columns" picker -- show/hide, reorder, and rename any table's
// columns, remembered per table via its own localStorage key (storageKey)
// so Sales' column choices don't affect Bills', etc. Originally built just
// for the Items list (see lossTabColumns.ts/LossTab.tsx); every other
// per-page table reuses this same hook + button instead of
// re-implementing the picker chrome from scratch.
export type ColumnDef<K extends string> = { key: K; label: string; width?: number }

export type ColumnPrefs<K extends string> = {
  columns: ColumnDef<K>[]
  visibleCols: Set<K>
  colOrder: K[]
  columnLabels: Partial<Record<K, string>>
  shownColumns: ColumnDef<K>[]
  toggleCol: (key: K) => void
  moveCol: (key: K, dir: -1 | 1) => void
  renameColumn: (key: K, label: string) => void
  resetVisible: () => void
}

export function useColumnPrefs<K extends string>(storageKey: string, columns: ColumnDef<K>[]): ColumnPrefs<K> {
  const allKeys = columns.map(c => c.key)
  const byKey = new Map(columns.map(c => [c.key, c]))

  const [visibleCols, setVisibleCols] = useState<Set<K>>(() => {
    if (typeof window === 'undefined') return new Set(allKeys)
    try {
      const saved = JSON.parse(localStorage.getItem(`${storageKey}VisibleCols`) ?? 'null')
      if (Array.isArray(saved) && saved.length > 0) {
        const keep = saved.filter((k): k is K => allKeys.includes(k))
        if (keep.length > 0) return new Set(keep)
      }
    } catch { /* ignore malformed storage */ }
    return new Set(allKeys)
  })
  useEffect(() => {
    localStorage.setItem(`${storageKey}VisibleCols`, JSON.stringify(Array.from(visibleCols)))
  }, [visibleCols, storageKey])

  const [colOrder, setColOrder] = useState<K[]>(() => {
    if (typeof window === 'undefined') return allKeys
    try {
      const saved = JSON.parse(localStorage.getItem(`${storageKey}ColOrder`) ?? 'null')
      if (Array.isArray(saved)) {
        const valid = saved.filter((k): k is K => allKeys.includes(k))
        if (valid.length > 0) return [...valid, ...allKeys.filter(k => !valid.includes(k))]
      }
    } catch { /* ignore malformed storage */ }
    return allKeys
  })
  useEffect(() => {
    localStorage.setItem(`${storageKey}ColOrder`, JSON.stringify(colOrder))
  }, [colOrder, storageKey])

  const [columnLabels, setColumnLabels] = useState<Partial<Record<K, string>>>(() => {
    if (typeof window === 'undefined') return {}
    try {
      const saved = JSON.parse(localStorage.getItem(`${storageKey}ColumnLabels`) ?? 'null')
      if (saved && typeof saved === 'object') return saved
    } catch { /* ignore malformed storage */ }
    return {}
  })
  useEffect(() => {
    localStorage.setItem(`${storageKey}ColumnLabels`, JSON.stringify(columnLabels))
  }, [columnLabels, storageKey])

  function toggleCol(key: K) {
    setVisibleCols(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key); else next.add(key)
      return next
    })
  }
  function moveCol(key: K, dir: -1 | 1) {
    setColOrder(prev => {
      const i = prev.indexOf(key)
      const j = i + dir
      if (i < 0 || j < 0 || j >= prev.length) return prev
      const next = [...prev]
      ;[next[i], next[j]] = [next[j], next[i]]
      return next
    })
  }
  function renameColumn(key: K, label: string) {
    const trimmed = label.trim()
    setColumnLabels(prev => {
      const next = { ...prev }
      if (trimmed) next[key] = trimmed; else delete next[key]
      return next
    })
  }
  function resetVisible() {
    setVisibleCols(new Set())
  }

  const shownColumns = colOrder.map(k => byKey.get(k)).filter((c): c is ColumnDef<K> => !!c && visibleCols.has(c.key))
    .map(c => columnLabels[c.key] ? { ...c, label: columnLabels[c.key]! } : c)

  return { columns, visibleCols, colOrder, columnLabels, shownColumns, toggleCol, moveCol, renameColumn, resetVisible }
}

// Drag-to-resize column widths -- separate from useColumnPrefs above
// (visibility/order/labels) since not every table that uses those needs
// resizing too. Widths are in pixels, persisted per table via their own
// localStorage key. Only takes effect where the caller renders its table
// with `tableLayout: fixed` and a matching <colgroup> (see CountsTab.tsx).
export function useResizableWidths(storageKey: string, defaults: Record<string, number>) {
  const [widths, setWidths] = useState<Record<string, number>>(() => {
    if (typeof window === 'undefined') return defaults
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null')
      if (saved && typeof saved === 'object') return { ...defaults, ...saved }
    } catch { /* ignore malformed storage */ }
    return defaults
  })
  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(widths))
  }, [widths, storageKey])

  function resize(key: string, deltaPx: number) {
    setWidths(prev => ({ ...prev, [key]: Math.max(36, Math.round((prev[key] ?? defaults[key] ?? 80) + deltaPx)) }))
  }
  function resetOne(key: string) {
    setWidths(prev => ({ ...prev, [key]: defaults[key] }))
  }
  return { widths, resize, resetOne }
}

// A thin draggable strip pinned to a header cell's right edge -- the cell
// itself needs `relative` positioning for this to sit correctly. Pointer
// Events (not mouse events) so a drag keeps tracking even once the pointer
// leaves this 8px-wide handle, and the same code path handles touch too.
// Double-click resets that one column back to its default width.
export function ColResizeHandle({ onResize, onReset }: { onResize: (deltaPx: number) => void; onReset?: () => void }) {
  const lastX = useRef(0)
  return (
    <span
      onPointerDown={e => {
        e.preventDefault()
        e.stopPropagation()
        lastX.current = e.clientX
        ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      }}
      onPointerMove={e => {
        if (e.buttons !== 1) return
        const delta = e.clientX - lastX.current
        if (delta !== 0) { onResize(delta); lastX.current = e.clientX }
      }}
      onDoubleClick={onReset}
      title="Drag to resize, double-click to reset"
      className="absolute top-0 right-0 z-10 h-full w-2 -mr-1 cursor-col-resize touch-none select-none hover:bg-blue-400/40 active:bg-blue-500/60"
    />
  )
}

export type ExtraToggle = { key: string; label: string; active: boolean; onToggle: () => void }

// `dark` is for the one instance sitting directly on Grony Cash's own deep
// green controls row (see item/page.tsx) -- every other caller renders on a
// plain white content area, so it stays the default gray chip there. That
// same instance's trigger also sits at the LEFT of its row (Columns/
// Analytics/New, New pushed right via ml-auto) instead of the right like
// every other caller's, so `dark` doubles as the signal to open the
// dropdown from the left edge instead -- anchoring it to the right there
// pushed it half off a narrow phone screen.
// `extraToggles` are on/off switches unrelated to any one column -- Items'
// Alias Wide Table and Service Matches views, currently -- shown above the
// column list with their own "Views" header so they read as a distinct
// group rather than more columns. The trigger button itself picks up an
// accent color whenever one of them is on, so that's visible without
// opening the panel.
export function ColumnsPickerButton<K extends string>({ prefs, dark = false, extraToggles }: {
  prefs: ColumnPrefs<K>; dark?: boolean; extraToggles?: ExtraToggle[]
}) {
  const [open, setOpen] = useState(false)
  const [renamingCol, setRenamingCol] = useState<K | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const ref = useRef<HTMLDivElement>(null)
  const byKey = new Map(prefs.columns.map(c => [c.key, c]))

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  const anyExtraActive = !!extraToggles?.some(t => t.active)

  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Columns"
        className={`flex items-center justify-center w-7 h-7 rounded-lg transition
          ${anyExtraActive ? 'bg-blue-600 text-white' : dark ? 'text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </svg>
      </button>
      {open && (
        <div className={`absolute top-full mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px] max-h-72 overflow-y-auto
          ${dark ? 'left-0' : 'right-0'}`}>
          {extraToggles && extraToggles.length > 0 && (
            <div className="border-b border-gray-100 pb-0.5 mb-0.5">
              <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-wide">Views</p>
              {extraToggles.map(t => (
                <label key={t.key}
                  className="flex items-center gap-1.5 px-2.5 py-1 text-xs text-gray-700 cursor-pointer select-none hover:bg-gray-50">
                  <input type="checkbox" checked={t.active} onChange={t.onToggle}
                    className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </label>
              ))}
            </div>
          )}
          {prefs.colOrder.map((key, i) => {
            const c = byKey.get(key)
            if (!c) return null
            const label = prefs.columnLabels[key] ?? c.label
            if (renamingCol === key) return (
              <div key={key} className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 last:border-0">
                <input autoFocus value={renameValue} onChange={e => setRenameValue(e.target.value)}
                  placeholder={c.label}
                  onKeyDown={e => {
                    if (e.key === 'Enter') { prefs.renameColumn(key, renameValue); setRenamingCol(null) }
                    if (e.key === 'Escape') setRenamingCol(null)
                  }}
                  className="flex-1 min-w-0 text-xs border border-gray-300 rounded px-1.5 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                <button onClick={() => { prefs.renameColumn(key, renameValue); setRenamingCol(null) }} title="Save"
                  className="shrink-0 text-green-600 hover:text-green-700 px-1 text-xs font-bold">✓</button>
                <button onClick={() => setRenamingCol(null)} title="Cancel"
                  className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-xs font-bold">×</button>
              </div>
            )
            return (
              <div key={key} className="flex items-center gap-1 px-2 py-1 border-b border-gray-100 last:border-0">
                <label className="flex items-center gap-1.5 flex-1 min-w-0 text-xs text-gray-700 cursor-pointer select-none">
                  <input type="checkbox" checked={prefs.visibleCols.has(key)} onChange={() => prefs.toggleCol(key)}
                    className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
                  <span className="truncate">{label}</span>
                </label>
                <button onClick={() => { setRenamingCol(key); setRenameValue(label === c.label ? '' : label) }} title="Rename column"
                  className="shrink-0 text-gray-300 hover:text-gray-600 px-0.5 text-xs">✎</button>
                <button onClick={() => prefs.moveCol(key, -1)} disabled={i === 0} title="Move up"
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 px-1 text-xs leading-none">▲</button>
                <button onClick={() => prefs.moveCol(key, 1)} disabled={i === prefs.colOrder.length - 1} title="Move down"
                  className="text-gray-400 hover:text-gray-700 disabled:opacity-25 disabled:hover:text-gray-400 px-1 text-xs leading-none">▼</button>
              </div>
            )
          })}
          {prefs.visibleCols.size > 0 && (
            <button onClick={prefs.resetVisible}
              className="w-full text-left px-2.5 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50">
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  )
}
