import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { isOwnerLevel } from '@/lib/roles'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { NextRequest } from 'next/server'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_signatures (
    law_id INTEGER NOT NULL, staff TEXT NOT NULL, signed_at TIMESTAMPTZ NOT NULL DEFAULT now(), law_hash TEXT NOT NULL, PRIMARY KEY (law_id, staff))`.catch(() => {})
})
// A signature stays valid only while the law's wording is unchanged: a changed law has to be signed again.

// GET -- my signatures: { signed: { lawId: signed_at }, unsigned, total, signers }. The owner and Joe sign nothing, so for them
// unsigned is 0; with ?all=1 they also get every staff member's signed laws.
export async function GET(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const owner = isOwnerLevel(user as any)
    const me = actorKey(user as any)
    const live = await sql`SELECT id, md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h FROM page_laws WHERE status = 'live'`
    const mine = await sql`SELECT law_id, law_hash, signed_at FROM law_signatures WHERE staff = ${me}`
    const mineMap = new Map(mine.map(r => [Number(r.law_id), r]))
    const signed: Record<number, string> = {}
    for (const l of live) { const m = mineMap.get(Number(l.id)); if (m && m.law_hash === l.h) signed[Number(l.id)] = String(m.signed_at) }
    const out: Record<string, unknown> = { signed, total: live.length, unsigned: owner ? 0 : live.length - Object.keys(signed).length }
    if (owner && req.nextUrl.searchParams.get('all')) {
      const staff = await sql`SELECT username FROM app_users WHERE active IS NOT FALSE AND role NOT IN ('owner', 'children_manager') AND LOWER(username) <> 'joe' ORDER BY username`
      const all = await sql`SELECT law_id, staff, law_hash FROM law_signatures`
      const hashes = new Map(live.map(l => [Number(l.id), l.h]))
      const by: Record<string, number[]> = {}
      for (const r of all) if (hashes.get(Number(r.law_id)) === r.law_hash) (by[String(r.staff)] ??= []).push(Number(r.law_id))
      out.staff = staff.map(s => String(s.username)); out.by = by
    }
    return success(out)
  } catch (e) { return handleError('law-signatures GET', e) }
}

// POST { ids: number[] } -- sign these laws (live laws only).
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const b = await req.json().catch(() => ({}))
    const ids = (Array.isArray(b.ids) ? b.ids : []).map(Number).filter(Number.isInteger)
    if (!ids.length) return badRequest('Nothing to sign.')
    const me = actorKey(user as any)
    const rows = await sql`SELECT id, md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h FROM page_laws WHERE status = 'live' AND id = ANY(${ids})`
    for (const r of rows) await sql`INSERT INTO law_signatures (law_id, staff, law_hash) VALUES (${r.id}, ${me}, ${r.h}) ON CONFLICT (law_id, staff) DO UPDATE SET law_hash = ${r.h}, signed_at = now()`
    return success({ signed: rows.length })
  } catch (e) { return handleError('law-signatures POST', e) }
}
