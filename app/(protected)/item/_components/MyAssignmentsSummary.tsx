'use client'
import { useSession } from 'next-auth/react'
import { ASSIGNABLE_VIOLATIONS } from './violationAssignments'

// A personalized "what's mine" summary -- only renders once there's
// something assigned to whoever's actually looking. Used to sit atop the
// now-removed Cash/Manage Tasks pages; lives on the Home/Today tab instead,
// since every type it covers has its own page-level flag section now and
// this is purely a cross-page personal digest rather than a way to act on
// anything itself.
export function MyAssignmentsSummary({ assignments, deadlines }: { assignments: Record<string, string>; deadlines: Record<string, string> }) {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const mine = username ? ASSIGNABLE_VIOLATIONS.filter(v => (assignments[v.type] ?? '').toLowerCase() === username) : []
  if (mine.length === 0) return null
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl overflow-hidden">
      <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wide px-3 pt-2.5 pb-1">Assigned to You</p>
      <div className="divide-y divide-blue-100">
        {mine.map(v => (
          <div key={v.type} className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs">
            <span className="text-gray-700 truncate">{v.label}</span>
            {deadlines[v.type] && <span className="text-gray-500 shrink-0">due {deadlines[v.type]}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}
