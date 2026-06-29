'use client'
import ActivityToaster from '@/components/ActivityToaster'
import LivePresence from '@/components/LivePresence'

export default function ClientWidgets() {
  return (
    <>
      <ActivityToaster />
      <LivePresence />
    </>
  )
}
