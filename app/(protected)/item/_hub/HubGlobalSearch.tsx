'use client'
import type { HubCtx } from './useHubState'
import HubGlobalSearchBox from './HubGlobalSearchBox'

export default function HubGlobalSearch({ h }: { h: HubCtx }) {
  const { globalSearchOpen, closeGlobalSearch, items } = h
  return (<>{globalSearchOpen && (
        <div className="fixed inset-0 z-50 bg-black/30 flex items-start justify-center pt-16 px-4" onClick={closeGlobalSearch}>
          <HubGlobalSearchBox h={h} />
        </div>
      )}</>)
}
