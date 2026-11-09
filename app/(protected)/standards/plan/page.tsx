import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import PlanClient from './PlanClient'

export default async function ChecklistPlanPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <PlanClient />
}
