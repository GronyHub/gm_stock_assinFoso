'use client'
import { useViolations } from './useViolations'
import { ViolationRow } from './ViolationRow'

// Promoted from Home's "🗂️ Grony Manage" submenu to its own top-level tab,
// mirroring Grony Cash: Cash covers the money aspect, Manage covers
// everything else (staff times, count duties, item hygiene).
export default function GronyManageTab({ onGoToViolation, counts }: {
  onGoToViolation?: (key: string) => void
  counts?: Record<string, number>
}) {
  const { flags, assignments, deadlines, assignedBy, assignedOn, vSettings, manageViolations, manageCount } = useViolations(counts)

  return (
    <div className="py-2 px-2 space-y-1.5">
      <div className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
        <div className="flex items-center justify-between mb-0.5">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">
            🗂️ Grony Manage Flags {manageCount > 0 && <span className="text-red-500">🚩{manageCount}</span>}
          </p>
        </div>
        {!flags ? (
          <p className="text-[11px] text-gray-400 py-[1px]">Loading…</p>
        ) : (
          <div>
            {manageViolations.map(v => (
              <ViolationRow key={v.type} v={v} assignments={assignments} deadlines={deadlines}
                assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                onGoToViolation={onGoToViolation} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
