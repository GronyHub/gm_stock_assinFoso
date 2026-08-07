'use client'
import { createContext, useContext, useState, useCallback } from 'react'

export type ToolsPanelKind = 'law' | 'notes' | 'tasks'

type ToolsPanelState = { scopeKey: string; kind: ToolsPanelKind } | null

type ToolsPanelContextValue = {
  panel: ToolsPanelState
  openPanel: (scopeKey: string, kind: ToolsPanelKind) => void
  closePanel: () => void
}

const ToolsPanelContext = createContext<ToolsPanelContextValue | null>(null)

// Combines a page's own Law/Notes/Tasks into one window rendered in the
// same right-pane content space every other page uses -- not the small
// floating modal PageToolIcons used to render locally (fixed inset-0,
// covering the whole screen including the left pane). Every PageToolIcons
// instance, no matter how deep in the tree it's mounted, calls
// openPanel(scopeKey, kind) instead of managing its own open/closed modal
// state -- only item/page.tsx (which owns the content area's real layout)
// can render the panel positioned correctly, so this just carries "which
// page's panel, on which tab" up to it. See CombinedToolsPanel.tsx for the
// actual panel UI and where it's mounted.
//
// useToolsPanel() returns null when no provider is present -- PageToolIcons
// falls back to its old local modal in that case, which is what the two
// standalone routes outside item/page.tsx's tree (/staff,
// /staff-times/review -- no shared left pane to keep visible anyway) still
// get, without needing their own provider.
export function ToolsPanelProvider({ children }: { children: React.ReactNode }) {
  const [panel, setPanel] = useState<ToolsPanelState>(null)
  const openPanel = useCallback((scopeKey: string, kind: ToolsPanelKind) => setPanel({ scopeKey, kind }), [])
  const closePanel = useCallback(() => setPanel(null), [])
  return (
    <ToolsPanelContext.Provider value={{ panel, openPanel, closePanel }}>
      {children}
    </ToolsPanelContext.Provider>
  )
}

export function useToolsPanel() {
  return useContext(ToolsPanelContext)
}
