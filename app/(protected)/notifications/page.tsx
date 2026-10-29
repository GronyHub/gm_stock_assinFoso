import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import NotificationsClient from './NotificationsClient'

export default async function NotificationsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as never)) redirect('/item')
  return <NotificationsClient />
}
