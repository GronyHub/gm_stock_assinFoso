import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import GuideClient from '../how-to/GuideClient'

export default async function OwnerGuidePage() {
  const session = await auth()
  if (!session) redirect('/login')
  if (!isOwnerLevel(session.user as any)) redirect('/item')
  return <GuideClient mode="owner" />
}
