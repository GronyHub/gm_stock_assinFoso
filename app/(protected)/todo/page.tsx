import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DailyChecklistClient from '../standards/DailyChecklistClient'
import { isOwnerLevel } from '@/lib/roles'
import CctvDue from '@/components/CctvDue'
import TodoAhead from '@/components/TodoAhead'
import PendingJobsDue from '@/components/PendingJobsDue'

// The team's To do for the day: every recurring law due today, arranged by time, with who did it. It is the Shop's "To do" tab.
// (Each person's own To do is the Waiting for me tab on their profile.)
export default async function TodoPage() {
  const session = await auth()
  if (!session) redirect('/login')
  const manager = isOwnerLevel(session.user as never)
  return <><div className="pt-3"><DailyChecklistClient canManage={manager} embedded extras={<><PendingJobsDue />{manager && <CctvDue />}</>} /></div><div className="px-3 pb-24"><TodoAhead /></div></>
}
