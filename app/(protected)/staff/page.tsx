import { auth } from '@/lib/auth'
import StaffClient from './StaffClient'

export default async function StaffPage() {
  const session = await auth()
  const role = (session?.user as any)?.role ?? 'staff'
  return <StaffClient role={role} />
}
