import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import MyDayClient from './MyDayClient'

export default async function MyDayPage() {
  const s = await auth()
  if (!s) redirect('/login')
  return <MyDayClient />
}
