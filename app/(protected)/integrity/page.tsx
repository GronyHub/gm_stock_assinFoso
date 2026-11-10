import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { redirect } from 'next/navigation'
import IntegrityClient from './IntegrityClient'

export default async function IntegrityPage() {
  const s = await auth()
  if (!s || !isOwnerLevel(s.user as never)) redirect('/item')
  return <IntegrityClient />
}
