import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import ManageTilesClient from './ManageTilesClient'

export default async function ManageTilesPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as any)) redirect('/standards')
  return <ManageTilesClient />
}
