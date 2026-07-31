'use client'
import { SidePaneButton, type DisplayMode } from './SidePane'

const HomeIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5 10v9a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-4a1 1 0 0 1 1-1h0a1 1 0 0 1 1 1v4a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-9" />
  </svg>
)
const DailyIcon = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <line x1="16" y1="3" x2="16" y2="7" />
    <line x1="8" y1="3" x2="8" y2="7" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
)

// Home and Daily used to float above the whole page as two circular
// buttons, always on screen regardless of which tab or scroll position --
// now they're a fixed footer row on Grony Cash's and Grony Manage's own
// left panes instead (see SidePaneContainer's `footer` prop), side by side,
// sitting right above the still-floating "+" shortcut button. Both jump to
// a view of the SAME pane they're clicked from (Cash's own 'home'/
// 'dailySummary' lossViews, Manage's own 'home'/'daily' ManageViews) rather
// than switching tabs, so the pane and top menu stay on screen exactly like
// picking any other item here does -- `homeActive`/`dailyActive` reflect
// that real per-pane state instead of always reading false/one-sided.
export default function PaneHomeDaily({ mode, onHome, onDaily, homeActive = false, dailyActive, unreadAnnouncements }: {
  mode: DisplayMode
  onHome: () => void
  onDaily: () => void
  homeActive?: boolean
  dailyActive: boolean
  unreadAnnouncements: number
}) {
  return (
    <div className="border-t border-white/10 flex items-stretch shrink-0">
      <SidePaneButton icon={HomeIcon} label="Home" mode={mode} active={homeActive} badge={unreadAnnouncements}
        onClick={onHome} className="flex-1 min-w-0" />
      <div className="w-px bg-white/10 shrink-0" />
      <SidePaneButton icon={DailyIcon} label="Daily" mode={mode} active={dailyActive}
        onClick={onDaily} className="flex-1 min-w-0" />
    </div>
  )
}
