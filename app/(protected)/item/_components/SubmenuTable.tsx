'use client'
import { useState, useEffect, useRef } from 'react'
import PageToolIcons from './PageToolIcons'
import { useColumnPrefs, ColumnsPickerButton, ResizableTh, type ColumnDef } from './columnPrefs'
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

// A cell holding a URL renders as a clickable link instead of a text box --
// no per-column "type" needed, the value itself decides.
const isUrlLike = (v: string) => /^https?:\/\//i.test(v.trim()) || /^www\./i.test(v.trim())
const toHref = (v: string) => /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`

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

// The actual columns+rows grid -- pulled out from SubmenuTable and keyed by
// submenu.id in the parent below, since useColumnPrefs only reads its
// column-list argument once (at mount) and doesn't resync if it changes
// later. Switching submenus needs a fresh instance (its own width/order/
// visibility storage, keyed per submenu id) rather than one that keeps
// stale state from whichever submenu was open before.
function SubmenuGrid({ submenu, columns, rows, editCell, saveCell, deleteRow, addRow }: {
  submenu: UKSubmenu
  columns: UKColumn[]
  rows: UKRow[]
  editCell: (rowId: number, columnId: number, value: string) => void
  saveCell: (rowId: number, columnId: number, value: string) => void
  deleteRow: (id: number) => void
  addRow: () => void
}) {
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null)
  const byId = new Map(columns.map(c => [String(c.id), c]))
  const colDefs: ColumnDef<string>[] = columns.map(c => ({ key: String(c.id), label: c.name }))
  const prefs = useColumnPrefs<string>(`ukSubmenu-${submenu.id}`, colDefs)
  const shown = prefs.shownColumns.map(sc => byId.get(sc.key)).filter((c): c is UKColumn => !!c)

  if (columns.length === 0) return null

  const tableWidth = shown.reduce((s, c) => s + prefs.getWidth(String(c.id), GRID_DEFAULT_WIDTH), 0) + GRID_DELETE_COL_WIDTH

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Columns · {submenu.name}</p>
        <ColumnsPickerButton prefs={prefs} />
      </div>
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
                {shown.map(c => {
                  const val = r.values[c.id] ?? ''
                  const key = `${r.id}-${c.id}`
                  const showAsLink = isUrlLike(val) && editingCellKey !== key
                  return (
                    <td key={c.id} className="px-1 py-1 align-top">
                      {showAsLink ? (
                        <div className="flex items-center gap-1 px-2 py-1.5">
                          <a href={toHref(val)} target="_blank" rel="noopener noreferrer"
                            className="text-xs text-blue-600 underline break-all">{val}</a>
                          <button onClick={() => setEditingCellKey(key)} className="text-gray-300 hover:text-gray-600 shrink-0" title="Edit">✎</button>
                        </div>
                      ) : (
                        <textarea value={val} autoFocus={editingCellKey === key} rows={1}
                          ref={autoGrow}
                          onChange={e => { editCell(r.id, c.id, e.target.value); autoGrow(e.target) }}
                          onBlur={e => { saveCell(r.id, c.id, e.target.value); setEditingCellKey(null) }}
                          className="w-full min-w-[80px] text-xs px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 focus:border-blue-300 outline-none resize-none overflow-hidden whitespace-pre-wrap break-words" />
                      )}
                    </td>
                  )
                })}
                <td className="px-1 text-center">
                  <button onClick={() => deleteRow(r.id)} className="text-gray-300 hover:text-red-500 px-1" title="Delete row">×</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button onClick={addRow} className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50 border-t border-gray-100">
          + New Row
        </button>
      </div>
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
export default function SubmenuTable({ submenu, columns, rows, editCell, saveCell, deleteRow, addRow }: {
  submenu: UKSubmenu
  columns: UKColumn[]
  rows: UKRow[]
  editCell: (rowId: number, columnId: number, value: string) => void
  saveCell: (rowId: number, columnId: number, value: string) => void
  deleteRow: (id: number) => void
  addRow: () => void
}) {
  return (
    <div className="space-y-4 pb-10 px-3 pt-3">
      <PageToolIcons scopeKey={`${submenu.person} ${submenu.name}`} />
      <SubmenuFiles submenuId={submenu.id} />
      <SubmenuGrid key={submenu.id} submenu={submenu} columns={columns} rows={rows}
        editCell={editCell} saveCell={saveCell} deleteRow={deleteRow} addRow={addRow} />
    </div>
  )
}
