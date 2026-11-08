import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DailyChecklistClient from './DailyChecklistClient'
import { isOwnerLevel } from '@/lib/roles'

export default async function StandardsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <DailyChecklistClient canManage={isOwnerLevel(session.user as any)} />
}
