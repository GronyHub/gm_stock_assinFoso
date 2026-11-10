import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DailyChecklistClient from './DailyChecklistClient'
import { isOwnerLevel } from '@/lib/roles'
import ClockApprovals from '@/components/ClockApprovals'

export default async function StandardsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const owner = isOwnerLevel(session.user as any)
  return <>{owner && <ClockApprovals />}<DailyChecklistClient canManage={owner} /></>
}
