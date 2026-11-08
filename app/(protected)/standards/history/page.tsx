import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import HistoryClient from './HistoryClient'

export default async function ChecklistHistoryPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as any)) redirect('/standards')
  return <HistoryClient />
}
