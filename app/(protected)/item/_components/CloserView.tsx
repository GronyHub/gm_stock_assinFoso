'use client'
import ClosingReportsList from '@/components/ClosingReportsList'

// The closer's own accountability view -- whether any past day is missing
// its closing report, plus the actual submitted reports (moved here from
// the Times tab, since this is the dedicated Closer page). Extracted from
// the old Role Bar's Closer panel into a left-pane item of its own inside
// Grony Manage.
export default function CloserView({ missingClosingReportsCount, onOpenStaff }: {
  missingClosingReportsCount: number
  onOpenStaff: () => void
}) {
  return (
    <div className="px-4 py-2 space-y-4">
      {missingClosingReportsCount > 0 ? (
        <div className="space-y-2">
          <p className="text-sm text-gray-700">
            🌙 The closing report was missed on {missingClosingReportsCount} past day{missingClosingReportsCount !== 1 ? 's' : ''}.
          </p>
          <button onClick={onOpenStaff}
            className="w-full text-sm font-semibold px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition">
            Go to Staff →
          </button>
        </div>
      ) : (
        <p className="text-sm text-gray-400 py-4">✓ Every day has a closing report.</p>
      )}

      <div className="space-y-2">
        <p className="text-sm font-semibold text-gray-700">Closing Reports</p>
        <ClosingReportsList />
      </div>
    </div>
  )
}
