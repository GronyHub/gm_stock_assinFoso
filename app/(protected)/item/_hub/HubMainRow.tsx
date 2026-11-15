'use client'
import { useState } from 'react'
import PresentStaffBar from '../_components/PresentStaffBar'
import { SidePaneToggle } from '../_components/SidePane'
import SettingsPane from '../_components/SettingsPane'
import { UKSettingsPanel, UKTab } from './hubShared'
import type { HubCtx } from './useHubState'
import HubSidePane from './HubSidePane'
import HubStaffBarAndOverlays from './HubStaffBarAndOverlays'
import HubPhoneTabs from './HubPhoneTabs'
import HubSelectionBar from './HubSelectionBar'

export default function HubMainRow({ h }: { h: HubCtx }) {
  const { outerTab, settingsOpen, uk, setUkPaneRefresh, role, isGrony, canOpenSettings } = h
  // On a phone the menu is hidden behind the bottom More tab; it opens as a full-height overlay and closes on any tap inside it.
  const [moreOpen, setMoreOpen] = useState(false)
  return (<><div className="relative flex-1 min-h-0 flex overflow-hidden pb-14 sm:pb-0">
        {moreOpen && <div className="fixed inset-0 z-40 bg-black/40 sm:hidden" onClick={() => setMoreOpen(false)} />}
        <div onClickCapture={e => { const b = (e.target as HTMLElement).closest('button'); if (b && !b.hasAttribute('data-more-toggle')) setMoreOpen(false) }}
          className={moreOpen ? 'fixed inset-y-0 left-0 z-50 flex' : 'hidden sm:flex'}>
          <HubSidePane h={h} />
        </div>
        {/* Restore button while the pane is hidden -- floats over the
            content area's own bottom-left corner rather than taking a
            layout slot of its own, same reasoning as SidePaneToggle's onHide
            button above (no extra border/column either way). Sits at the
            bottom, not the top, so it doesn't cover PresentStaffBar/the tab
            switcher's own top-left content on a narrow (mobile) screen. */}
        {/* UK's own Settings (add a menu / add a column) is a content-area
            panel, unlike Biz/C&H's Settings rows (now inline in the pane
            above, see SettingsPane.tsx) -- gated to isGrony specifically,
            matching UKTab's own data gate, rather than canOpenSettings'
            broader Biz-role checks (which say nothing about who's allowed
            to see or edit UK data at all). */}
        {settingsOpen && outerTab === 'uk' && isGrony && (
          <UKSettingsPanel onChanged={() => setUkPaneRefresh(k => k + 1)} />
        )}

        <HubStaffBarAndOverlays h={h} />
      </div>
      <HubPhoneTabs h={h} moreOpen={moreOpen} onToggleMore={() => setMoreOpen(o => !o)} onNavigate={() => setMoreOpen(false)} />
      <HubSelectionBar h={h} />
      </>)
}
