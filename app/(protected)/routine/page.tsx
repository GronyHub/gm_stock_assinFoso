import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import RoutineClient from './RoutineClient'

export default async function RoutinePage() {
  const session = await auth()
  if (!session) redirect('/login')
  const role = (session.user as { role?: string })?.role ?? 'staff'
  return <RoutineClient canEdit={role !== 'staff'} />
}
