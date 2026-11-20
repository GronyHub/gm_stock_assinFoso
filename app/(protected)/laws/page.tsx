import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { isOwnerLevel } from '@/lib/roles'
import LawsClient from './LawsClient'

// The general Company Laws list is gone: every law lives on its topic, and search is on Manage.
// A link to one law or one topic (without embed) opens that topic's embedded page; a bare /laws goes to Manage.
export default async function CompanyLawsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const session = await auth()
  if (!session) redirect('/login')
  const sp = await searchParams
  if (sp.embed === undefined) {
    if (sp.law !== undefined || sp.tile !== undefined) {
      const qs = new URLSearchParams()
      for (const [k, v] of Object.entries(sp)) if (typeof v === 'string') qs.set(k, v)
      qs.set('embed', '1')
      redirect(`/laws?${qs.toString()}`)
    }
    redirect('/item?mode=manage')
  }
  const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? ''
  const initial = { embedded: true, tile: one(sp.tile) || null, subs: one(sp.subs).split('|').filter(Boolean), assign: one(sp.assign), nolaw: one(sp.nolaw) === '1' }
  return <LawsClient canManage={isOwnerLevel(session.user as any)} initial={initial} />
}
