'use client'
import type { HubCtx } from './useHubState'
import HubLogDay from './HubLogDay'

export default function HubLogRows({ h }: { h: HubCtx }) {
  const {  } = h
  return (<><tbody>
                    {<HubLogDay h={h} />}
                    </tbody></>)
}
