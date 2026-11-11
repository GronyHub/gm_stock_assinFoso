'use client'
import type { HubCtx } from './useHubState'
import HubLossTableSwitch from './HubLossTableSwitch'

export default function HubExtraViewSwitch({ h }: { h: HubCtx }) {
  const { liveShowCountFullPage, liveCurrentView } = h
  return (<>{liveCurrentView?.kind !== 'aliasWide' && liveCurrentView?.kind !== 'serviceMatches' && liveCurrentView?.kind !== 'newItem' && liveCurrentView?.kind !== 'dailySummary' && liveCurrentView?.kind !== 'gmcPacks' && !liveShowCountFullPage && (
            <>
              {<HubLossTableSwitch h={h} />}
            </>
            )}</>)
}
