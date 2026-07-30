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
const WIDTH: Record<DisplayMode, string> = { icon: 'w-14', both: 'w-20', text: 'w-24' }

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

export function SidePaneToggle({ mode, onChange }: { mode: DisplayMode; onChange: (mode: DisplayMode) => void }) {
  return (
    <div className="flex items-stretch gap-0.5 p-1 border-b border-gray-200 bg-white sticky top-0 z-10">
      {(['icon', 'both', 'text'] as DisplayMode[]).map(m => (
        <button key={m} onClick={() => onChange(m)} title={MODE_LABEL[m]}
          className={`flex-1 flex items-center justify-center py-1 rounded text-[11px] transition
            ${mode === m ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
          {GLYPH[m]}
        </button>
      ))}
    </div>
  )
}

// One entry in a left pane -- icon on top, label below, either half hidden
// depending on `mode`, label capped at 2 lines instead of forcing the pane
// wider for a long name. `className` controls sizing: default `w-full` for
// a standalone list; pass `flex-1 min-w-0` when placed in a row alongside
// another control (e.g. a trailing delete button). `badge` overlays a small
// count in the corner (e.g. Grony Cash's flag counts) -- shown in every mode
// including icon-only, since that's exactly when a count matters most.
export function SidePaneButton({ icon, label, active, mode, onClick, badge, className = 'w-full' }: {
  icon?: string; label: string; active: boolean; mode: DisplayMode; onClick: () => void; badge?: number; className?: string
}) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className={`relative flex flex-col items-center justify-center gap-0.5 px-1 py-2 text-[10px] font-medium leading-tight text-center transition
        ${active ? 'bg-blue-100 text-blue-700 font-semibold' : 'text-gray-700 hover:bg-gray-100'} ${className}`}>
      {mode !== 'text' && <span className="text-base leading-none">{icon ?? '•'}</span>}
      {mode !== 'icon' && <span className="line-clamp-2">{label}</span>}
      {!!badge && badge > 0 && (
        <span className="absolute top-0.5 right-0.5 flex items-center justify-center min-w-[14px] h-[14px] px-0.5 text-[8px] font-bold leading-none rounded-full bg-red-600 text-white">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </button>
  )
}

export function SidePaneContainer({ mode, children }: { mode: DisplayMode; children: React.ReactNode }) {
  return (
    <div className={`${paneWidthClass(mode)} shrink-0 border-r border-gray-200 bg-gray-50 overflow-y-auto`}>
      {children}
    </div>
  )
}
