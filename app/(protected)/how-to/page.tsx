import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import GuideClient from './GuideClient'

export default async function HowToPage() {
  const session = await auth()
  if (!session) redirect('/login')
  return <GuideClient mode="howto" />
}
