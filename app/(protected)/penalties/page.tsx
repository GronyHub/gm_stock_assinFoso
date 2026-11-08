import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import PenaltiesClient from './PenaltiesClient'

export default async function PenaltiesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as any)) redirect('/profile')
  return <PenaltiesClient isOwner={(session.user as { role?: string })?.role === 'owner'} />
}
