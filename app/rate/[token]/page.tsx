import { getRatingInfo } from '@/lib/ratings'
import RateClient from './RateClient'

export const dynamic = 'force-dynamic'

// Public page opened from the receipt message. No login.
export default async function RatePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  // /rate/demo shows the page itself (for the training videos); real links are never this short
  if (token === 'demo') return <RateClient token="demo" valid={true} already={false} staff="Bino" />
  const info = /^[A-Za-z0-9_-]{8,40}$/.test(token) ? await getRatingInfo(token).catch(() => null) : null
  const first = info ? info.staff.charAt(0).toUpperCase() + info.staff.slice(1) : ''
  return <RateClient token={token} valid={!!info} already={!!info?.rated} staff={first} />
}
