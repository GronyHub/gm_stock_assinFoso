'use client'
import { CABTab, ProfitLossTab } from './hubShared'
import type { HubCtx } from './useHubState'
import HubSaleFlagTables from './HubSaleFlagTables'

export default function HubLiveExpanded({ h }: { h: HubCtx }) {
  const { group, search, liveExpanded, setLiveExpanded, liveSaleViolationFilter, items, liveRootClassName, renderModeToggleRow } = h
  return (<><div className={liveRootClassName}>
            {liveExpanded && (
              <button
                type="button"
                onClick={() => setLiveExpanded(false)}
                title="Exit large screen"
                className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
              >
                ✕
              </button>
            )}
            {renderModeToggleRow()}

            {/* P&L/CAB now ride the Sale filter row's own radio group (see
                liveSaleViolationFilter, just above the search bar below) --
                selecting either replaces this whole grid with ProfitLossTab/
                CABTab instead of filtering it. */}
            {<HubSaleFlagTables h={h} />}
          </div></>)
}
