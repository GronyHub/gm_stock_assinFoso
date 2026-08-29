'use client'
import { SidePaneButton, type DisplayMode } from './SidePane'

const DailyIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

// Used to be paired with Home as two circular floating buttons, then a
// side-by-side footer row (see git history) -- Home has since moved up to
// the top of the Cash list itself (first row, above Items), so this is now
// just Daily on its own in the footer, still pinned there so it stays on
// screen regardless of scroll position, right above the floating "+"
// shortcut button.
export default function PaneDaily({ mode, onDaily, dailyActive }: {
  mode: DisplayMode
  onDaily: () => void
  dailyActive: boolean
}) {
  return (
    <div className="border-t border-white/10 flex items-stretch shrink-0">
      <SidePaneButton icon={DailyIcon} label="Daily" mode={mode} active={dailyActive}
        onClick={onDaily} className="w-full" />
    </div>
  )
}
