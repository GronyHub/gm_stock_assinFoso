'use client'
import { useSyncExternalStore } from 'react'

// Shared building blocks for the "always-visible narrow left pane, full-
// width right pane" navigation pattern used throughout this app (Grony
// Manage, Staff, ...). One shared component means every left pane looks
// and behaves identically, and a single display-mode preference applies
// everywhere instead of each page remembering its own.
export type DisplayMode = 'icon' | 'text' | 'both'

const DISPLAY_MODE_KEY = 'sidePaneDisplayMode'
const GLYPH: Record<DisplayMode, string> = { icon: '🔘', both: '◧', text: '🔤' }
const MODE_LABEL: Record<DisplayMode, string> = { icon: 'Icons only', both: 'Icons + text', text: 'Text only' }
// Narrower on phones than on tablet/desktop (sm: 640px+) -- a fixed width
// regardless of screen size meant the pane ate the same chunk out of a
// 360px phone as a 1200px desktop, squeezing the content pane's tables
// (often 5-6 columns wide) down to almost nothing on mobile. Icon-only
// stays at that same minimal width on every screen since it never renders
// text at all, but text/both need real room to fit a word -- at the old
// shared mobile width (56px, same as icon-only) an ordinary label like
// "Urgent" or "Ghana" had nowhere to go but one character per line once
// SidePaneButton's label span was fixed to wrap inside its box instead of
// overflowing it.
const WIDTH: Record<DisplayMode, string> = { icon: 'w-14', both: 'w-16 sm:w-20', text: 'w-20 sm:w-24' }

// A module-level store (not per-component state) so every left pane on
// screen at once -- Grony Manage's, and Staff's several nested ones --
// reacts to a mode change immediately, instead of each only picking up
// localStorage once on its own mount and drifting out of sync with the rest.
function isDisplayMode(v: string | null): v is DisplayMode {
  return v === 'icon' || v === 'text' || v === 'both'
}
let currentMode: DisplayMode = 'both'
if (typeof window !== 'undefined') {
  const saved = localStorage.getItem(DISPLAY_MODE_KEY)
  if (isDisplayMode(saved)) currentMode = saved
}
const listeners = new Set<() => void>()
function setGlobalMode(mode: DisplayMode) {
  currentMode = mode
  localStorage.setItem(DISPLAY_MODE_KEY, mode)
  listeners.forEach(l => l())
}
function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
function getSnapshot() { return currentMode }
function getServerSnapshot(): DisplayMode { return 'both' }

export function useSidePaneDisplayMode(): [DisplayMode, (mode: DisplayMode) => void] {
  const mode = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
  return [mode, setGlobalMode]
}

export function paneWidthClass(mode: DisplayMode) {
  return WIDTH[mode]
}

// `label` names who's logged in (small, above the toggle row) -- kept
// inside this same sticky header rather than a separate element so it
// stays visible while the list below scrolls, instead of scrolling away
// with the very first thing in the pane.
export function SidePaneToggle({ mode, onChange, label }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void; label?: string }) {
  return (
    <div className="border-b border-white/30 bg-[var(--pane-accent)] sticky top-0 z-10">
      {label && <p className="px-1.5 pt-1 text-[9px] font-semibold text-blue-200 truncate">{label}</p>}
      <div className="flex items-stretch gap-0.5 p-1">
        {(['icon', 'both', 'text'] as DisplayMode[]).map(m => (
          <button key={m} onClick={() => onChange(m)} title={MODE_LABEL[m]}
            className={`flex-1 flex items-center justify-center py-1 rounded text-[11px] transition
              ${mode === m ? 'bg-white text-[var(--pane-accent)]' : 'bg-white/10 text-blue-100 hover:bg-white/20'}`}>
            {GLYPH[m]}
          </button>
        ))}
      </div>
    </div>
  )
}

// One entry in a left pane -- icon on top, label below, either half hidden
// depending on `mode`, label capped at a single line (truncated with an
// ellipsis) instead of wrapping to a second line or forcing the pane wider
// for a long name -- the full name is still on the button's `title`
// tooltip. `className` controls sizing: default `w-full` for
// a standalone list; pass `flex-1 min-w-0` when placed in a row alongside
// another control (e.g. a trailing delete button, or a sibling footer
// button -- see Home/Daily in item/page.tsx). `badge` (red, top-left) overlays
// a flag/violation count; `taskBadge` (green, top-right) overlays that same
// page's own open task count (see DynamicTasksSection/custom_tasks) -- both
// shown in every mode including icon-only, since that's exactly when a count
// matters most. Opposite corners so a page with both flags and open tasks
// shows both counts at once instead of one clobbering the other.
// `icon` takes a plain emoji string for the common case, or a ReactNode
// (e.g. an inline SVG) for spots that need a real icon instead -- Home/Daily
// used their own hand-drawn SVGs when they were floating buttons, and kept
// them here rather than switching to an emoji.
// `tint` marks a button as its own always-on-color identity rather than
// following the pane's current accent (e.g. the UK/C&H nav buttons, which
// stay deep red/green even while sitting in the Biz-blue pane so they're
// recognizable before you've clicked into them) -- see the UK/C&H buttons
// in item/page.tsx for the only current callers.
// `divider` draws a thin top-edge line separating this button from
// whichever one sits directly above it -- pass true for every button
// except the first one under a given section/group header (the header
// itself already marks that break, an extra line right under it would be
// redundant) or the very first button in the pane. Every caller looping
// over a list is expected to compute this itself (e.g. `i > 0`) rather than
// this component guessing position from context it doesn't have.
// `chipLabel` -- for a row whose own name IS a section's name too (Sales
// the row vs. "Sales" the section header above Sales/New Sale/Live Sale/
// Log, same for Expenses and Customers) -- draws the label in the same
// yellow-fill/red-text chip style a real section header uses, instead of
// plain white text, so that row doubles as the section's own heading
// rather than sitting redundantly under a separate "Sales" label that
// says the same thing twice. Still a normal, fully clickable button --
// only the label's own styling changes. See item/page.tsx's Cash pane
// loop for where the separate header is skipped for exactly these rows.
export function SidePaneButton({ icon, label, active, mode, onClick, badge, taskBadge, className = 'w-full', tint, divider, chipLabel }: {
  icon?: string | React.ReactNode; label: string; active: boolean; mode: DisplayMode; onClick: () => void; badge?: number; taskBadge?: number; className?: string; tint?: string; divider?: boolean; chipLabel?: boolean
}) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      style={tint ? { backgroundColor: active ? '#fff' : tint, color: active ? tint : '#fff' } : undefined}
      className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-1 text-[10px] font-medium leading-tight text-center transition
        ${divider ? 'border-t border-white/35' : ''}
        ${tint ? 'font-semibold' : active ? 'bg-white text-[var(--pane-accent)] font-semibold' : 'text-white hover:bg-white/10'} ${className}`}>
      {mode !== 'text' && (
        typeof icon === 'string' || icon === undefined
          ? <span className="text-base leading-none">{icon ?? '•'}</span>
          : <span className="leading-none">{icon}</span>
      )}
      {/* `items-center` on the flex-col button above sizes children to
          their own content instead of stretching them, so without an
          explicit w-full a label that overflows the button (free-typed
          submenu names especially) sizes wider than the button and gets
          centered instead of clipped from its own left edge. w-full forces
          the real width so truncate's overflow:hidden/ellipsis clips it
          from the right, at the button's actual edge, the same way every
          other single-line label on the page does. */}
      {mode !== 'icon' && (
        chipLabel
          ? <span className="w-full flex justify-center"><span className="max-w-full truncate text-[8px] font-extrabold text-red-700 bg-yellow-400 uppercase tracking-wide rounded px-1.5 py-0.5">{label}</span></span>
          : <span className="w-full truncate">{label}</span>
      )}
      {/* No background shape on either badge -- a filled circle sitting on
          top of the label was covering some of its lettering, especially in
          `both` mode where icon and label share limited vertical space.
          Bare bold number instead, with a white text-shadow (not a solid
          fill) so it still reads clearly regardless of which pane accent
          color it's sitting on. */}
      {!!badge && badge > 0 && (
        <span className="absolute top-0.5 left-0.5 min-w-[14px] text-[9px] font-black leading-none text-red-600 [text-shadow:0_0_2px_white,0_0_2px_white,0_0_2px_white]">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
      {!!taskBadge && taskBadge > 0 && (
        <span className="absolute top-0.5 right-0.5 min-w-[14px] text-[9px] font-black leading-none text-green-600 [text-shadow:0_0_2px_white,0_0_2px_white,0_0_2px_white]">
          {taskBadge > 99 ? '99+' : taskBadge}
        </span>
      )}
    </button>
  )
}

// `footer` renders outside the scrollable area, pinned to the pane's own
// bottom edge instead of scrolling away with the rest of the list --
// Home/Daily specifically, which used to float above the whole page and
// needed to stay reachable no matter how far the list above scrolled.
// Solid blue fill + white text (see SidePaneButton) so the pane reads as a
// clearly distinct region from the plain white content pane next to it,
// rather than the two blurring together.
// `accent` is the pane's current section color (Biz blue by default, or
// UK/C&H's deep red/green while active) -- set as a CSS variable here so
// every SidePaneButton and SidePaneToggle nested inside (including ones
// reached through `footer`) can pick it up via `var(--pane-accent)` without
// each of their ~18 call sites needing their own accent prop threaded
// through individually.
export function SidePaneContainer({ mode, footer, children, accent = '#00072d' }: {
  mode: DisplayMode; footer?: React.ReactNode; children: React.ReactNode; accent?: string
}) {
  return (
    <div style={{ '--pane-accent': accent } as React.CSSProperties}
      className={`${paneWidthClass(mode)} shrink-0 border-r border-white/10 bg-[var(--pane-accent)] flex flex-col min-h-0`}>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {children}
      </div>
      {footer}
    </div>
  )
}
