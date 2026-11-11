import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// The Daily Checklist is the Shop's "To do" tab now (/todo). Old links keep their ?tile= and ?closing=.
export default async function StandardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v)
  redirect('/todo' + (q.toString() ? '?' + q.toString() : ''))
}
