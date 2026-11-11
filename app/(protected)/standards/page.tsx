import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'

// The Daily Checklist is no longer its own page: it is the "Today" view of the Company Laws (the recurring laws arranged by day and time).
export default async function StandardsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(await searchParams)) if (typeof v === 'string') q.set(k, v)
  q.set('view', 'today')
  redirect('/laws?' + q.toString())
}
