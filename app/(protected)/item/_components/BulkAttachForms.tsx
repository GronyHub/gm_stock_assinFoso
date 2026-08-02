'use client'
import { useRef, useState } from 'react'
import { uploadAttachment, type Attachment } from './attachmentsShared'

type Receipt = { id: number; receipt_date: string; customer_name: string | null; attachments: Attachment[] | null }

type RowStatus = 'idle' | 'uploading' | 'done' | 'error'
type Row = { id: string; file: File; date: string; status: RowStatus; error?: string }

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

function fmtCust(name: string | null) {
  if (!name) return 'W'
  const u = name.toLowerCase()
  if (u.includes('walk') || u.includes('wic')) return 'W'
  return 'G'
}

// A whole batch is always one month (that's what the source folder itself
// represents -- e.g. "2026 JULY"), so all this needs to pull out of each
// filename is the day number, not a full date. Filenames in practice
// aren't consistent (seen: "2026 JULY 28TH.jpg", but not guaranteed to
// match everywhere), so several patterns are tried in order of how
// unambiguous they are -- an ordinal suffix (28TH, 1ST, 3RD, 22ND) is a
// strong, specific signal for "this number is a day"; a lone 1-2 digit
// number not touching other digits is the last-resort fallback. Anything
// that still doesn't yield a confident day is left blank for the user to
// set by hand rather than risk attaching a file to the wrong receipt.
function extractDay(filename: string): number | null {
  const name = filename.replace(/\.[a-z0-9]+$/i, '')
  const ordinal = name.match(/\b(\d{1,2})(?:st|nd|rd|th)\b/i)
  if (ordinal) {
    const d = Number(ordinal[1])
    if (d >= 1 && d <= 31) return d
  }
  const isoLike = name.match(/\b\d{4}[-_./](\d{1,2})[-_./](\d{1,2})\b/)
  if (isoLike) {
    const d = Number(isoLike[2])
    if (d >= 1 && d <= 31) return d
  }
  const dmyLike = name.match(/\b(\d{1,2})[-_./]\d{1,2}[-_./]\d{4}\b/)
  if (dmyLike) {
    const d = Number(dmyLike[1])
    if (d >= 1 && d <= 31) return d
  }
  const lone = name.match(/(?<!\d)(\d{1,2})(?!\d)/)
  if (lone) {
    const d = Number(lone[1])
    if (d >= 1 && d <= 31) return d
  }
  return null
}

export default function BulkAttachForms({ receipts, onDone, onClose }: {
  receipts: Receipt[]
  onDone: () => void
  onClose: () => void
}) {
  const [month, setMonth] = useState(new Date().getMonth() + 1)
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  // Tracks each receipt's attachments as this batch attaches to them, so a
  // second file landing on the same date (rare, but possible) merges onto
  // the first one's result instead of the stale prop snapshot -- without
  // mutating the `receipts` prop itself.
  const mergedAttachments = useRef<Map<number, Attachment[]>>(new Map())
  const fileInputRef = useRef<HTMLInputElement>(null)

  function dateFor(day: number) {
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  function addFiles(files: FileList | null) {
    if (!files) return
    const newRows: Row[] = Array.from(files).map((file, i) => {
      const day = extractDay(file.name)
      return { id: `${file.name}-${Date.now()}-${i}`, file, date: day ? dateFor(day) : '', status: 'idle' }
    })
    setRows(prev => [...prev, ...newRows])
  }

  function setRowDate(id: string, date: string) {
    setRows(prev => prev.map(r => r.id === id ? { ...r, date } : r))
  }

  function removeRow(id: string) {
    setRows(prev => prev.filter(r => r.id !== id))
  }

  function matchedReceipt(date: string): Receipt | undefined {
    if (!date) return undefined
    return receipts.find(r => r.receipt_date?.slice(0, 10) === date && fmtCust(r.customer_name) === 'W')
  }

  async function attachOne(row: Row) {
    const receipt = matchedReceipt(row.date)
    if (!receipt) {
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', error: 'No W receipt for this date' } : r))
      return
    }
    setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'uploading' } : r))
    try {
      // Shared with the single-attachment picker -- compresses large
      // images and quietly retries once, since a file straight off Google
      // Drive (as this batch tool's files usually are) can fail its first
      // upload attempt while the OS is still fetching its bytes.
      const uploaded = await uploadAttachment(row.file)

      const existing = mergedAttachments.current.get(receipt.id) ?? receipt.attachments ?? []
      const nextAttachments = [...existing, uploaded]
      const headerRes = await fetch(`/api/sales/${receipt.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attachments: nextAttachments }),
      })
      const updated = await headerRes.json().catch(() => ({}))
      if (!headerRes.ok) throw new Error(updated.error ?? 'Could not save to receipt')
      mergedAttachments.current.set(receipt.id, updated.attachments ?? nextAttachments)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'done' } : r))
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed'
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', error: message } : r))
    }
  }

  async function attachAllMatched() {
    setRunning(true)
    // Sequential, not parallel -- keeps mergedAttachments consistent if two
    // files land on the same date, and avoids hammering the upload route
    // with a burst of simultaneous requests for a batch this size.
    for (const row of rows) {
      if (row.status === 'idle' && matchedReceipt(row.date)) await attachOne(row)
    }
    setRunning(false)
    onDone()
  }

  const readyCount = rows.filter(r => r.status === 'idle' && matchedReceipt(r.date)).length

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-3">
      <div className="bg-white rounded-xl w-full max-w-md max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 shrink-0">
          <p className="font-bold text-sm text-gray-900">Bulk Attach Forms</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
        </div>
        <div className="p-3 space-y-2 overflow-y-auto flex-1">
          <p className="text-[10px] text-gray-400">
            Select every form photo/scan for one month at once — each is matched to that day&apos;s Walk-In (W) receipt by the date in its filename. Fix any that couldn&apos;t be read automatically below.
          </p>
          <div className="flex gap-1.5">
            <select value={month} onChange={e => setMonth(Number(e.target.value))}
              className="flex-1 text-xs bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 outline-none">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <input type="number" value={year} onChange={e => setYear(Number(e.target.value))}
              className="w-20 text-xs bg-gray-100 border border-gray-200 rounded-lg px-2 py-1.5 outline-none" />
          </div>
          {/* A ref + button-click trigger, not a label wrapping a hidden
              input -- the label pattern doesn't reliably open the picker on
              some mobile browsers, where this one (already proven working
              in the single-attachment picker) does. */}
          <button type="button" onClick={() => fileInputRef.current?.click()}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg px-3 py-1.5 transition">
            + Choose Files
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={e => { addFiles(e.target.files); e.target.value = '' }}
          />

          {rows.length > 0 && (
            <div className="space-y-1 border-t border-gray-100 pt-2">
              {rows.map(row => {
                const receipt = matchedReceipt(row.date)
                return (
                  <div key={row.id} className="flex items-center gap-1.5 text-[10px] bg-gray-50 rounded-lg px-2 py-1.5">
                    <span className="flex-1 min-w-0 truncate text-gray-700" title={row.file.name}>{row.file.name}</span>
                    <input type="date" value={row.date} onChange={e => setRowDate(row.id, e.target.value)}
                      disabled={row.status !== 'idle'}
                      className="shrink-0 bg-white border border-gray-200 rounded px-1 py-0.5 text-[10px] outline-none disabled:opacity-50" />
                    {row.status === 'idle' && (
                      receipt
                        ? <span className="shrink-0 text-green-600 font-semibold">✓ matched</span>
                        : <span className="shrink-0 text-red-500 font-semibold">{row.date ? 'no W receipt' : 'set date'}</span>
                    )}
                    {row.status === 'uploading' && <span className="shrink-0 text-blue-500 font-semibold">…</span>}
                    {row.status === 'done' && <span className="shrink-0 text-green-600 font-semibold">✓ done</span>}
                    {row.status === 'error' && <span className="shrink-0 text-red-500 font-semibold" title={row.error}>✗ {row.error}</span>}
                    <button onClick={() => removeRow(row.id)} disabled={row.status === 'uploading'} title="Remove"
                      className="shrink-0 text-gray-300 hover:text-red-400 font-bold disabled:opacity-30">×</button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="p-3 border-t border-gray-100 shrink-0">
          <button onClick={attachAllMatched} disabled={running || readyCount === 0}
            className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2 transition">
            {running ? 'Attaching…' : `Attach ${readyCount} Matched Form${readyCount !== 1 ? 's' : ''}`}
          </button>
        </div>
      </div>
    </div>
  )
}
