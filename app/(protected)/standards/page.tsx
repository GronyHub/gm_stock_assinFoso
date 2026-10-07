import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StandardsClient from './StandardsClient'

export default async function StandardsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as { role?: string })?.role ?? 'staff'
  return <StandardsClient canEdit={role !== 'staff'} />
}
