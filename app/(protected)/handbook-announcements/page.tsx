import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import AnnouncementsClient from './AnnouncementsClient'

export default async function HandbookAnnouncementsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as any)) redirect('/item')
  return <AnnouncementsClient />
}
