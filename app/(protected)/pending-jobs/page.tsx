import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PendingJobsClient from './PendingJobsClient'
import { isOwnerLevel } from '@/lib/roles'

export default async function PendingJobsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <PendingJobsClient canDelete={isOwnerLevel(session.user as never)} />
}
