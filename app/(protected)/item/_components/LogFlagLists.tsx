'use client'
import { MissingDayFix } from './SalesTab'
import HistoryPanel from './HistoryPanel'

// Sales Log list views that aren't a filter of the day rows, carried over from Sales Rec / Summary:
// missing days (with their fix: add the day's sales or mark it a no-work day), duplicate receipts, and the
// history of sales / receipt changes. Loaded only when one is opened.
type Flags = { missingDays?: { missing_date: string }[]; dupReceipts?: { receipt_date: string; customer_type: string; receipt_count: number; receipt_numbers: string }[] }

export default function LogFlagLists({ view, flags, onFixedMissing, onClose, onPickDate }: {
  view: 'missing_days' | 'dup_receipt' | 'history'
  flags: Flags | null
  onFixedMissing: (date: string) => void
  onClose: () => void
  onPickDate: (date: string) => void
}) {
  const title = view === 'missing_days' ? 'Missing days' : view === 'dup_receipt' ? 'Duplicate receipts' : 'Sales history'
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 items-center gap-1.5 border-b border-gray-200 bg-gray-50 px-2 py-1">
        <button type="button" onClick={onClose} className="rounded bg-purple-600 px-1.5 py-0.5 text-[9px] font-semibold text-white">← Back to the Log</button>
        <span className="text-[9px] font-semibold text-purple-700">{title}</span>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto py-2">
        {view === 'history' ? (
          <HistoryPanel keywords={['sale', 'receipt']} onEntryClick={() => {}} />
        ) : !flags ? (
          <p className="px-2 text-[10px] text-gray-400">Loading…</p>
        ) : view === 'missing_days' ? (
          (flags.missingDays ?? []).length === 0 ? <p className="py-4 text-center text-[10px] text-gray-400">No missing days found.</p> : (
            <>
              <p className="mb-1 px-2 text-[10px] text-gray-400">{flags.missingDays!.length} day(s) with no sales recorded. Add the day&apos;s sales with + Past sale, or mark it a no-work day.</p>
              <div className="divide-y divide-gray-100 border-y border-gray-200 bg-white">
                {flags.missingDays!.map(r => <MissingDayFix key={r.missing_date} date={r.missing_date} onFixed={onFixedMissing} />)}
              </div>
            </>
          )
        ) : (
          (flags.dupReceipts ?? []).length === 0 ? <p className="py-4 text-center text-[10px] text-gray-400">No duplicate receipts found.</p> : (
            <div className="divide-y divide-gray-100 border-y border-gray-200 bg-white">
              {flags.dupReceipts!.map((r, i) => (
                <button key={i} type="button" onClick={() => onPickDate(r.receipt_date.slice(0, 10))} className="block w-full px-2 py-2 text-left hover:bg-blue-50">
                  <span className="block text-[10px] font-semibold text-gray-900">{r.receipt_date.slice(0, 10)} — {r.customer_type} <span className="text-red-500">({r.receipt_count} receipts)</span></span>
                  <span className="mt-0.5 block text-[9px] text-gray-400">{r.receipt_numbers}</span>
                </button>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
