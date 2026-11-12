import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import WaitingForTeam from '@/components/WaitingForTeam'
import { isOwnerLevel } from '@/lib/roles'

// The team's To do for the day: every recurring law due today, arranged by time, with who did it. It is the Shop's "To do" tab.
// (Each person's own To do is the Waiting for me tab on their profile.)
export default async function TodoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const manager = isOwnerLevel(session.user as never)
  return <WaitingForTeam canManage={manager} />
}
