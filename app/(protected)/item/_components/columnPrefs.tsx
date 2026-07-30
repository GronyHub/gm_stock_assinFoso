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

export function ColumnsPickerButton<K extends string>({ prefs }: { prefs: ColumnPrefs<K> }) {
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

  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Columns"
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="4" width="18" height="16" rx="2" />
          <line x1="9" y1="4" x2="9" y2="20" />
          <line x1="15" y1="4" x2="15" y2="20" />
        </svg>
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[200px] max-h-72 overflow-y-auto">
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
