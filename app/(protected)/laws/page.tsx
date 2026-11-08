import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import LawsClient from './LawsClient'

export default async function CompanyLawsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <LawsClient canManage={isOwnerLevel(session.user as any)} />
}
