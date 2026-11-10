import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { redirect } from 'next/navigation'
import CctvClient from './CctvClient'

export default async function CctvReviewPage() {
  const s = await auth()
  if (!s || !isOwnerLevel(s.user as never)) redirect('/')
  return <CctvClient />
}
