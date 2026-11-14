import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import PenaltiesClient from './PenaltiesClient'

export default async function PenaltiesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  // Staff see their own points on their page's Penalty Points tab.
  if (!isOwnerLevel(session.user as any)) redirect('/item?me=violations')
  return <PenaltiesClient isOwner={(session.user as { role?: string })?.role === 'owner'} />
}
