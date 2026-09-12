'use client'
import { fmtDate } from '@/lib/fmtDate'

function fmtQ(n: number) { return n % 1 === 0 ? String(n) : n.toFixed(2) }

// Blocks a sale/service tap for ANY item touching a GMC chain (the pack,
// the target itself, or a service consuming it -- see item/page.tsx's
// recordTap) whenever the target's currently-open cycle has already used
// more than its own pack gave. Unlike ClockInGateModal, this is NOT a
// one-time-per-session dismiss -- it re-checks on every tap attempt (see
// liveGmcOpenOverage in item/page.tsx), so it keeps coming back until a
// new pack is actually tapped in or a count settles it. "Continue anyway"
// only lets THIS one tap through.
export default function GmcOverageGateModal({
  itemName, targetName, given, used, exhaustedOnDate, onGoToCount, onGoToGmc, onContinue,
}: {
  itemName: string
  targetName: string
  given: number
  used: number
  exhaustedOnDate: string
  onGoToCount: () => void
  onGoToGmc: () => void
  onContinue: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onContinue}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-gray-900">📦 Check the packs before continuing</p>
          <p className="text-xs text-gray-500 mt-1">
            {itemName === targetName ? targetName : `${itemName} draws on ${targetName}, which`} has already used{' '}
            <span className="font-semibold text-red-600">{fmtQ(used)}</span> against the{' '}
            <span className="font-semibold">{fmtQ(given)}</span> the last pack gave -- already over, with no new
            pack recorded yet.
          </p>
          <p className="text-xs text-gray-500 mt-2">
            Based on today's records, this pack most likely ran out on{' '}
            <span className="font-semibold text-gray-700">{fmtDate(exhaustedOnDate)}</span>. If a pack really is
            short (or missing), or one was already opened but never tapped in GMC, a physical count will show
            which -- if a new pack was opened, record it dated {fmtDate(exhaustedOnDate)} rather than today.
          </p>
        </div>
        <div className="flex flex-col gap-1.5">
          <button onClick={onGoToCount}
            className="w-full bg-fuchsia-600 text-white text-sm font-bold rounded-lg py-2 hover:bg-fuchsia-500">
            Go to Count
          </button>
          <button onClick={onGoToGmc}
            className="w-full bg-blue-600 text-white text-sm font-bold rounded-lg py-2 hover:bg-blue-500">
            Record a GMC pack
          </button>
          <button onClick={onContinue}
            className="w-full bg-gray-100 text-gray-600 text-xs font-semibold rounded-lg py-2 hover:bg-gray-200">
            Continue anyway
          </button>
        </div>
      </div>
    </div>
  )
}
