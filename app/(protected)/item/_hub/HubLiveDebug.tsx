'use client'
import { LossDialog, GainDialog, PairingDialog } from '../_components/CountDialogs'
import type { HubCtx } from './useHubState'
import HubLiveExpanded from './HubLiveExpanded'
import HubGridItemEditor from './HubGridItemEditor'

export default function HubLiveDebug({ h }: { h: HubCtx }) {
  const { liveSaleMounted, liveMode, liveDebugLogs, liveLossPrompt, setLiveLossPrompt, liveGainPrompt, setLiveGainPrompt, livePairingPrompt, setLivePairingPrompt } = h
  return (<>{liveMode === 'sale' && liveSaleMounted && (<>
          {liveDebugLogs.length > 0 && (
            <div className="fixed top-4 right-4 bg-black text-white text-[12px] rounded px-3 py-2 max-w-xs z-50 shadow-lg">
              {liveDebugLogs.map((log, i) => <div key={i} className="whitespace-normal break-words">{log}</div>)}
            </div>
          )}
          <HubLiveExpanded h={h} />

          {<HubGridItemEditor h={h} />}

          {liveLossPrompt && <LossDialog prompt={liveLossPrompt} onClose={() => setLiveLossPrompt(null)} />}
          {liveGainPrompt && <GainDialog prompt={liveGainPrompt} onClose={() => setLiveGainPrompt(null)} />}
          {livePairingPrompt && <PairingDialog prompt={livePairingPrompt} onClose={() => setLivePairingPrompt(null)} />}
          </>)}</>)
}
