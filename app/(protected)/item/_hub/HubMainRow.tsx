'use client'
import { useEffect, useState } from 'react'
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
  // On a phone there is no side menu: the bottom More tab opens the same grouped menu as a full-screen page (Menu header, close button),
  // and it closes on any tap on one of its buttons. Computers keep the sidebar.
  const [moreOpen, setMoreOpen] = useState(false)
  // On a phone, the owner and Joe land on Home (the day at a glance) once per browser session, unless a link asked for a particular page.
  useEffect(() => {
    try {
      if (!window.matchMedia('(max-width: 639px)').matches || !h.isOwnerOrJoe) return
      const p = new URLSearchParams(window.location.search)
      if (['mode', 'view', 'open', 'me', 'tab'].some(k => p.get(k))) return
      if (sessionStorage.getItem('homeShown')) return
      sessionStorage.setItem('homeShown', '1')
      h.openShop('dashboard')
    } catch { /* never block the app for this */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  // On a phone, the Live page (the + tab) shows the same buttons as the Menu along its top, as a strip that scrolls sideways (icon above name).
  const strip = !moreOpen && !!h.paneActive(h.modeActive('sale'))
  return (<><div className={`relative flex-1 min-h-0 flex overflow-hidden pb-14 sm:pb-0 ${strip ? 'max-sm:flex-col' : ''}`}>
        <div onClickCapture={e => { const b = (e.target as HTMLElement).closest('button'); if (b && !b.hasAttribute('data-more-toggle') && !b.hasAttribute('data-menu-close')) setMoreOpen(false) }}
          className={moreOpen ? 'menu-page fixed inset-x-0 bottom-[56px] top-0 z-50 flex flex-col bg-[#00072d] [&>nav]:min-h-0 [&>nav]:w-full! [&>nav]:flex-1 [&_nav_button]:text-[16px]' : strip ? 'cash-strip flex shrink-0 sm:flex' : 'hidden sm:flex'}>
          {moreOpen && (
            <div className="flex shrink-0 items-center justify-between border-b border-white/20 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] sm:hidden">
              <h1 className="text-lg text-white">Menu</h1>
              <button type="button" data-menu-close onClick={() => setMoreOpen(false)} aria-label="Close menu"
                className="flex h-11 w-11 items-center justify-center rounded-full text-2xl text-white hover:bg-white/10">✕</button>
            </div>
          )}
          <HubSidePane h={strip ? ({ ...h, cashDisplayMode: 'both', stripAll: true } as typeof h) : h} />
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
