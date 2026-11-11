'use client'
import PresentStaffBar from '../_components/PresentStaffBar'
import { SidePaneToggle } from '../_components/SidePane'
import SettingsPane from '../_components/SettingsPane'
import { UKSettingsPanel, UKTab } from './hubShared'
import type { HubCtx } from './useHubState'
import HubSidePane from './HubSidePane'
import HubStaffBarAndOverlays from './HubStaffBarAndOverlays'

export default function HubMainRow({ h }: { h: HubCtx }) {
  const { outerTab, settingsOpen, uk, setUkPaneRefresh, role, isGrony, canOpenSettings } = h
  return (<><div className="relative flex-1 min-h-0 flex overflow-hidden">
        {<HubSidePane h={h} />}
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
      </div></>)
}
