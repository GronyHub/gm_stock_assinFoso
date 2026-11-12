import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import GroupsBuilder from './GroupsBuilder'

export default async function QuestionGroupsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as never)) redirect('/laws')
  return <GroupsBuilder />
}
