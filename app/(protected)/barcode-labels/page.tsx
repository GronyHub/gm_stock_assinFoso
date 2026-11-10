import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'
import { redirect } from 'next/navigation'
import LabelsClient from './LabelsClient'

export default async function BarcodeLabelsPage() {
  const s = await auth()
  if (!s || !isOwnerLevel(s.user as never)) redirect('/item')
  return <LabelsClient />
}
