import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import DraftLaws from '@/components/DraftLaws'

// The laws waiting for approval, for the Waiting list and My Day to open (the same list is also on Manage).
export default async function DraftLawsPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <DraftLaws />
}
