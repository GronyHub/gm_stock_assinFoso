import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import StartOfDayClient from './StartOfDayClient'

export default async function StartOfDayPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <StartOfDayClient />
}
