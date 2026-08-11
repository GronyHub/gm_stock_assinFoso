'use client'
import { useState, useEffect, useRef } from 'react'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from './columnPrefs'
import { containsUrl, Linkify } from '@/lib/linkify'
import type { UKColumn, UKRow, UKSubmenu } from './ukViewData'

type UkFile = { id: number; submenu_id: number; file_url: string; file_name: string; content_type: string | null; uploaded_by: string | null; uploaded_at: string }

// Uploaded files attached to a submenu (e.g. Grony Investment's documents)
// -- separate from the columns/rows spreadsheet below. Self-contained: owns
// its own fetch/state rather than threading file props through every
// SubmenuTable caller, since files aren't part of the columns/rows editing
// flow at all.
function SubmenuFiles({ submenuId }: { submenuId: number }) {
  const [files, setFiles] = useState<UkFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function load() {
    fetch(`/api/uk/files?submenu_id=${submenuId}`).then(r => r.ok ? r.json() : []).then(d => {
      setFiles(Array.isArray(d) ? d : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [submenuId])

  async function handleFile(file: File) {
    setUploading(true)
    setError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/uk/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Upload failed')
      const saveRes = await fetch('/api/uk/files', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submenu_id: submenuId, file_url: data.url, file_name: data.fileName, content_type: data.contentType }),
      })
      if (saveRes.ok) {
        const row: UkFile = await saveRes.json()
        setFiles(prev => [row, ...prev])
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  async function removeFile(id: number) {
    if (!confirm('Delete this file?')) return
    setFiles(prev => prev.filter(f => f.id !== id))
    await fetch(`/api/uk/files/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return (
    <div className="space-y-1.5">
      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Files</p>
      {!loading && files.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl divide-y divide-gray-100">
          {files.map(f => (
            <div key={f.id} className="flex items-center gap-2 px-3 py-2">
              <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                className="flex-1 min-w-0 text-xs text-blue-600 underline truncate">{f.file_name}</a>
              <button onClick={() => removeFile(f.id)} className="text-gray-300 hover:text-red-500 shrink-0 px-1" title="Delete">×</button>
            </div>
          ))}
        </div>
      )}
      <label className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition cursor-pointer">
        {uploading ? 'Uploading…' : '📎 Upload File'}
        <input ref={inputRef} type="file" className="hidden" disabled={uploading}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx"
          onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f) }} />
      </label>
      {error && <p className="text-[10px] text-red-500">{error}</p>}
    </div>
  )
}

// A cell holding a link renders with that link clickable instead of as a
// plain text box -- no per-column "type" needed, the value itself decides.
// Used to only fire when the ENTIRE cell was just a URL (nothing else in
// it), which missed the far more common case of a link pasted in the
// middle of a longer note (e.g. "please use this link: https://... thank
// you") -- containsUrl/Linkify (lib/linkify.tsx) scan the whole value for
// any http(s)/www match anywhere in it instead, shared with every other
// notes field in the app that got the same treatment.

// Cells used to be a single-line <input> -- longer notes (multi-part to-dos,
// addresses, anything past the visible width) just scrolled off-screen with
// no visual sign there was more, unless you happened to click in and arrow
// past the edge. Growing the textarea's own height to fit its content on
// every keystroke (and on first render) means the whole value is always on
// screen, wrapped, instead of hidden past an invisible edge.
function autoGrow(el: HTMLTextAreaElement | null) {
  if (!el) return
  el.style.height = 'auto'
  el.style.height = `${el.scrollHeight}px`
}

const GRID_DEFAULT_WIDTH = 160
const GRID_DELETE_COL_WIDTH = 32

// Small standalone dropdown (not part of the shared columnPrefs.tsx picker,
// since "wide" is a UK/C&H-only concept every other table has no use for)
// listing every column with a checkbox to switch it between the resizable
// grid and a full-width block per row.
function ColumnLayoutButton({ columns, onToggleWide }: { columns: UKColumn[]; onToggleWide: (id: number, isWide: boolean) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function onOut(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onOut)
    return () => document.removeEventListener('mousedown', onOut)
  }, [])

  if (columns.length === 0) return null

  return (
    <div className="relative shrink-0" ref={ref}>
      <button onClick={() => setOpen(o => !o)} title="Column layout (narrow grid vs. wide full-width block)"
        className="flex items-center justify-center w-7 h-7 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition text-xs">
        ⤢
      </button>
      {open && (
        <div className="absolute top-full right-0 mt-0.5 bg-white border border-gray-200 rounded-lg shadow-lg z-30 min-w-[220px]">
          <p className="px-2.5 pt-1.5 pb-0.5 text-[9px] font-bold text-gray-400 uppercase tracking-wide">Column Layout</p>
          {columns.map(c => (
            <label key={c.id}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-gray-700 cursor-pointer select-none hover:bg-gray-50 border-b border-gray-50 last:border-0">
              <input type="checkbox" checked={c.is_wide} onChange={e => onToggleWide(c.id, e.target.checked)}
                className="w-3.5 h-3.5 accent-blue-600 shrink-0" />
              <span className="truncate flex-1">{c.name}</span>
              <span className="shrink-0 text-[9px] text-gray-400">{c.is_wide ? 'Wide' : 'Narrow'}</span>
            </label>
          ))}
        </div>
      )}
    </div>
  )
}

// The actual columns+rows grid -- pulled out from SubmenuTable and keyed by
// submenu.id in the parent below, since useColumnPrefs only reads its
// column-list argument once (at mount) and doesn't resync if it changes
// later. Switching submenus needs a fresh instance (its own width/order/
// visibility storage, keyed per submenu id) rather than one that keeps
// stale state from whichever submenu was open before.
function SubmenuGrid({ submenu, columns, rows, editCell, saveCell, deleteRow, addRow, toggleColumnWide }: {
  submenu: UKSubmenu
  columns: UKColumn[]
  rows: UKRow[]
  editCell: (rowId: number, columnId: number, value: string) => void
  saveCell: (rowId: number, columnId: number, value: string) => void
  deleteRow: (id: number) => void
  addRow: () => void
  toggleColumnWide: (id: number, isWide: boolean) => void
}) {
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null)
  // Wide columns skip the resizable grid entirely -- their value renders as
  // its own full-width block underneath each row instead, for fields with
  // too much text to fit comfortably in a narrow cell (options, long
  // notes). Only narrow columns feed useColumnPrefs/the grid.
  const narrowColumns = columns.filter(c => !c.is_wide)
  const wideColumns = columns.filter(c => c.is_wide)
  const byId = new Map(narrowColumns.map(c => [String(c.id), c]))
  const colDefs: ColumnDef<string>[] = narrowColumns.map(c => ({ key: String(c.id), label: c.name }))
  const prefs = useColumnPrefs<string>(`ukSubmenu-${submenu.id}`, colDefs)
  const shown = prefs.shownColumns.map(sc => byId.get(sc.key)).filter((c): c is UKColumn => !!c)

  if (columns.length === 0) return null

  const tableWidth = shown.reduce((s, c) => s + prefs.getWidth(String(c.id), GRID_DEFAULT_WIDTH), 0) + GRID_DELETE_COL_WIDTH

  // Wide blocks intentionally use the same small text size as narrow cells
  // (not bigger) -- a lot of pasted text (a whole letter, say) reads better
  // dense than blown up, and auto-grow already handles a wide cell's HEIGHT
  // scaling with however much text is actually in it.
  function renderCell(r: UKRow, c: UKColumn) {
    const val = r.values[c.id] ?? ''
    const key = `${r.id}-${c.id}`
    const showAsLink = val.trim() !== '' && containsUrl(val) && editingCellKey !== key
    if (showAsLink) {
      return (
        <div className="flex items-start gap-1 px-2 py-1.5">
          <Linkify text={val} as="p" className="flex-1 min-w-0 text-xs whitespace-pre-wrap break-words" />
          <button onClick={() => setEditingCellKey(key)} className="text-gray-300 hover:text-gray-600 shrink-0" title="Edit">✎</button>
        </div>
      )
    }
    return (
      <textarea value={val} autoFocus={editingCellKey === key} rows={1}
        ref={autoGrow}
        onChange={e => { editCell(r.id, c.id, e.target.value); autoGrow(e.target) }}
        onBlur={e => { saveCell(r.id, c.id, e.target.value); setEditingCellKey(null) }}
        className="w-full min-w-[80px] text-xs px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 focus:border-blue-300 outline-none resize-none overflow-hidden whitespace-pre-wrap break-words" />
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Columns · {submenu.name}</p>
        <div className="flex items-center gap-1">
          <ColumnLayoutButton columns={columns} onToggleWide={toggleColumnWide} />
          {narrowColumns.length > 0 && <ColumnsPickerButton prefs={prefs} />}
        </div>
      </div>

      {narrowColumns.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
          <table className="border-collapse text-xs" style={{ tableLayout: 'fixed', width: tableWidth }}>
            <colgroup>
              {shown.map(c => <col key={c.id} style={{ width: prefs.getWidth(String(c.id), GRID_DEFAULT_WIDTH) }} />)}
              <col style={{ width: GRID_DELETE_COL_WIDTH }} />
            </colgroup>
            <thead className="sticky top-0 bg-gray-50 z-10">
              <tr>
                {shown.map(c => (
                  <ResizableTh key={c.id}
                    onResize={d => prefs.resizeWidth(String(c.id), d, GRID_DEFAULT_WIDTH)}
                    onReset={() => prefs.resetWidth(String(c.id))}>
                    {prefs.columnLabels[String(c.id)] ?? c.name}
                  </ResizableTh>
                ))}
                <th className="border-b border-gray-200" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.id} className={`border-b border-gray-100 last:border-0 ${ri % 2 === 1 ? 'bg-gray-50/60' : 'bg-white'}`}>
                  {shown.map(c => (
                    <td key={c.id} className="px-1 py-1 align-top">{renderCell(r, c)}</td>
                  ))}
                  <td className="px-1 text-center align-top">
                    <button onClick={() => deleteRow(r.id)} className="text-gray-300 hover:text-red-500 px-1" title="Delete row">×</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {wideColumns.length === 0 && (
            <button onClick={addRow} className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50 border-t border-gray-100">
              + New Row
            </button>
          )}
        </div>
      )}

      {/* Wide-column blocks sit OUTSIDE the table's own bordered/
          overflow-x-auto box on purpose -- that box clips anything inside
          it to its own edges no matter what margin trick is tried, so
          reaching the true edges of the pane (the actual ask: "stretch
          from one end of the right pane to the other") means rendering
          these as full siblings of the table instead of nested inside it.
          -mx-3 cancels SubmenuTable's own px-3 wrapper padding. */}
      {wideColumns.length > 0 && (
        <div className="space-y-2 -mx-3">
          {rows.map((r, ri) => (
            <div key={r.id} className="bg-white border-y border-gray-200">
              <div className="px-3 py-1.5 flex items-center justify-between gap-2 bg-gray-50 border-b border-gray-100">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide truncate">
                  {narrowColumns.length > 0 && r.values[narrowColumns[0].id]
                    ? r.values[narrowColumns[0].id]
                    : `Row ${ri + 1}`}
                </p>
                <button onClick={() => deleteRow(r.id)} className="text-gray-300 hover:text-red-500 shrink-0 px-1 text-xs" title="Delete row">×</button>
              </div>
              <div className="px-3 py-2 space-y-2">
                {wideColumns.map(c => (
                  <div key={c.id}>
                    <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wide mb-0.5">{c.name}</p>
                    {renderCell(r, c)}
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="px-3">
            <button onClick={addRow} className="w-full text-left py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50 border border-gray-200 rounded-xl px-3">
              + New Row
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// The editable columns+rows table for one selected submenu -- split out of
// UKTab.tsx so CHTab.tsx can render the exact same table for Fiifi/Kuukua/
// Ebo/Odoye's submenus (moved there from UK, see chViewData.ts's
// CH_CHILD_PERSON) without duplicating this markup. Both read from the same
// uk_submenus/uk_columns/uk_rows tables via useUKData, just scoped to a
// different fixed person list. Column identity (add/rename/delete against
// the DB) is fixed from the UI's side (see UKSettingsPanel for adding one);
// show/hide, reorder, local rename, and width are all self-service per
// column here, same as every other table in the app.
export default function SubmenuTable({ submenu, columns, rows, editCell, saveCell, deleteRow, addRow, toggleColumnWide }: {
  submenu: UKSubmenu
  columns: UKColumn[]
  rows: UKRow[]
  editCell: (rowId: number, columnId: number, value: string) => void
  saveCell: (rowId: number, columnId: number, value: string) => void
  deleteRow: (id: number) => void
  addRow: () => void
  toggleColumnWide: (id: number, isWide: boolean) => void
}) {
  const lawsPanel = useLawsPanel(`showSubmenuLaws_${submenu.id}`)
  const scopeKey = `${submenu.person} ${submenu.name}`
  return (
    <div className="space-y-4 pb-10 px-3 pt-3">
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
          <PageLawsList scopeKey={scopeKey} isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
            openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
            hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}

              activeFilters={lawsPanel.activeFilters} />
        </div>
      )}
      <SubmenuFiles submenuId={submenu.id} />
      <SubmenuGrid key={submenu.id} submenu={submenu} columns={columns} rows={rows}
        editCell={editCell} saveCell={saveCell} deleteRow={deleteRow} addRow={addRow} toggleColumnWide={toggleColumnWide} />
    </div>
  )
}
