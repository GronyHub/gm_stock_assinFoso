'use client'
import { useState, useEffect, useRef } from 'react'

// Reusable "Columns" picker -- show/hide, reorder, and rename any table's
// columns, remembered per table via its own key (storageKey) so Sales'
// column choices don't affect Bills', etc. Originally built just for the
// Items list (see lossTabColumns.ts/LossTab.tsx); every other per-page
// table reuses this same hook + button instead of re-implementing the
// picker chrome from scratch.
//
// Shared via /api/app-settings (owner-level to write, everyone reads) --
// used to be per-browser localStorage, which meant a column layout the
// owner set up never showed on any other staff member's own device. See
// the "Shared Settings" policy: any owner-configured preference should
// apply the same way to everyone, not stay private to one browser.
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
  // Drag-to-resize widths, in pixels -- keyed by plain string rather than K
  // so a table can also register widths for fixed columns that aren't part
  // of the show/hide/reorder system (e.g. a sticky ITEM or DATE column).
  // Only takes effect where the table itself renders with `tableLayout:
  // fixed` and a matching <colgroup> reading these same widths (see
  // ResizableTh/ColResizeHandle below, and CountsTab.tsx for the pattern).
  getWidth: (key: string, fallback: number) => number
  resizeWidth: (key: string, deltaPx: number, fallback: number) => void
  resetWidth: (key: string) => void
}

export function useColumnPrefs<K extends string>(storageKey: string, columns: ColumnDef<K>[]): ColumnPrefs<K> {
  const allKeys = columns.map(c => c.key)
  const byKey = new Map(columns.map(c => [c.key, c]))
  const settingsKey = `colprefs:${storageKey}`

  const [visibleCols, setVisibleCols] = useState<Set<K>>(() => new Set(allKeys))
  const [colOrder, setColOrder] = useState<K[]>(() => allKeys)
  const [columnLabels, setColumnLabels] = useState<Partial<Record<K, string>>>({})
  const [widths, setWidths] = useState<Record<string, number>>({})
  // Guards the write effect below from firing (and overwriting the real
  // shared prefs with these defaults) before the initial fetch below has
  // actually resolved.
  const loadedRef = useRef(false)

  useEffect(() => {
    let cancelled = false
    loadedRef.current = false
    fetch(`/api/app-settings?key=${encodeURIComponent(settingsKey)}`)
      .then(r => r.ok ? r.json() : { value: null })
      .then((d: { value: unknown }) => {
        if (cancelled) return
        const saved = d?.value as {
          visibleCols?: string[]; colOrder?: string[]
          columnLabels?: Partial<Record<K, string>>; widths?: Record<string, number>
        } | null
        if (saved) {
          if (Array.isArray(saved.visibleCols)) {
            const keep = saved.visibleCols.filter((k): k is K => allKeys.includes(k as K))
            const newCols = allKeys.filter(k => !keep.includes(k))
            setVisibleCols(new Set([...keep, ...newCols]))
          }
          if (Array.isArray(saved.colOrder)) {
            const valid = saved.colOrder.filter((k): k is K => allKeys.includes(k as K))
            if (valid.length > 0) setColOrder([...valid, ...allKeys.filter(k => !valid.includes(k))])
          }
          if (saved.columnLabels && typeof saved.columnLabels === 'object') setColumnLabels(saved.columnLabels)
          if (saved.widths && typeof saved.widths === 'object') setWidths(saved.widths)
        }
        loadedRef.current = true
      })
      .catch(() => { loadedRef.current = true })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settingsKey])

  useEffect(() => {
    if (!loadedRef.current) return
    fetch('/api/app-settings', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: settingsKey, value: { visibleCols: Array.from(visibleCols), colOrder, columnLabels, widths } }),
    }).catch(() => {})
  }, [visibleCols, colOrder, columnLabels, widths, settingsKey])

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

  function getWidth(key: string, fallback: number): number {
    return widths[key] ?? fallback
  }
  function resizeWidth(key: string, deltaPx: number, fallback: number) {
    setWidths(prev => ({ ...prev, [key]: Math.max(36, Math.round((prev[key] ?? fallback) + deltaPx)) }))
  }
  function resetWidth(key: string) {
    setWidths(prev => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })
  }

  const shownColumns = colOrder.map(k => byKey.get(k)).filter((c): c is ColumnDef<K> => !!c && visibleCols.has(c.key))
    .map(c => columnLabels[c.key] ? { ...c, label: columnLabels[c.key]! } : c)

  return {
    columns, visibleCols, colOrder, columnLabels, shownColumns,
    toggleCol, moveCol, renameColumn, resetVisible,
    getWidth, resizeWidth, resetWidth,
  }
}

// A thin draggable strip pinned to a header cell's right edge -- the cell
// itself needs `relative` positioning for this to sit correctly. Pointer
// Events (not mouse events) so a drag keeps tracking even once the pointer
// leaves this 8px-wide handle, and the same code path handles touch too.
// Double-click resets that one column back to its default width. Some
// header cells (e.g. a sortable column) have their own onClick on the <th>
// itself -- click/dblclick are stopped from bubbling so ending a drag or
// double-clicking to reset never also fires that cell's own click handler.
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
      onClick={e => e.stopPropagation()}
      onDoubleClick={e => { e.stopPropagation(); onReset?.() }}
      title="Drag to resize, double-click to reset"
      className="absolute top-0 right-0 z-10 h-full w-2 -mr-1 cursor-col-resize touch-none select-none hover:bg-blue-400/40 active:bg-blue-500/60"
    />
  )
}

// Standard header cell for any resizable table -- bakes in the truncated
// label, a right-edge divider line (always visible, not just on hover, so
// there's a visual cue for where to grab), and the drag handle, so every
// table wires resizing the same consistent way instead of repeating this
// per table. Actual sizing comes from the table's own <colgroup> (matching
// widths via the same ColumnPrefs.getWidth calls) -- this component is
// purely presentational.
export function ResizableTh({ onResize, onReset, align = 'left', noDivider = false, className = '', children }: {
  onResize: (deltaPx: number) => void
  onReset: () => void
  align?: 'left' | 'center' | 'right'
  noDivider?: boolean
  className?: string
  children?: React.ReactNode
}) {
  const alignCls = align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left'
  return (
    <th className={`relative overflow-hidden px-2.5 py-2 font-bold text-gray-500 uppercase tracking-wide border-b border-gray-200 ${noDivider ? '' : 'border-r'} ${alignCls} ${className}`}>
      <span className="block truncate">{children}</span>
      <ColResizeHandle onResize={onResize} onReset={onReset} />
    </th>
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
export function ColumnsPickerButton<K extends string>({ prefs, dark = false, extraToggles, radioStyle = false }: {
  prefs: ColumnPrefs<K>; dark?: boolean; extraToggles?: ExtraToggle[]
  // Renders the trigger as a radio + text label instead of the icon button --
  // for callers (Sales tab) that put this alongside a row of other radios and
  // want it to match visually. Opt-in, defaults to the icon button everywhere
  // else so this doesn't change any other caller's look.
  radioStyle?: boolean
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
      {radioStyle ? (
        <label className="flex items-center gap-0.5 text-[10px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
          <input type="radio" checked={open || anyExtraActive} onClick={() => setOpen(o => !o)} onChange={() => {}}
            className="cursor-pointer w-2.5 h-2.5" />
          Columns
        </label>
      ) : (
        <button onClick={() => setOpen(o => !o)} title="Columns"
          className={`flex items-center justify-center w-7 h-7 rounded-lg transition
            ${anyExtraActive ? 'bg-blue-600 text-white' : dark ? 'text-white hover:bg-white/10' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="4" width="18" height="16" rx="2" />
            <line x1="9" y1="4" x2="9" y2="20" />
            <line x1="15" y1="4" x2="15" y2="20" />
          </svg>
        </button>
      )}
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
