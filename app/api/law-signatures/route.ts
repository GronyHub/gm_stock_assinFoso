import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { actorKey } from '@/lib/clockState'
import { SIGNERS } from '@/lib/signers'
import { ensureCompanyLaws } from '@/lib/pageLaws'
import { NextRequest } from 'next/server'

const ensure = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS law_signatures (
    law_id INTEGER NOT NULL, staff TEXT NOT NULL, signed_at TIMESTAMPTZ NOT NULL DEFAULT now(), law_hash TEXT NOT NULL, PRIMARY KEY (law_id, staff))`.catch(() => {})
})
// A signature stays valid only while the law's wording is unchanged: a changed law has to be signed again.

// GET -- everyone's signatures on the live laws: { signed: { lawId: signed_at } for me, me, signer, unsigned, total, staff, by: { name: lawIds } }.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureCompanyLaws(); await ensure()
    const me = actorKey(user as any)
    const signer = SIGNERS.includes(me)
    const live = await sql`SELECT id, md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h FROM page_laws WHERE status = 'live'`
    const all = await sql`SELECT law_id, staff, law_hash, signed_at FROM law_signatures WHERE staff = ANY(${SIGNERS})`
    const hashes = new Map(live.map(l => [Number(l.id), l.h]))
    const by: Record<string, number[]> = {}, signed: Record<number, string> = {}
    for (const r of all) {
      if (hashes.get(Number(r.law_id)) !== r.law_hash) continue
      ;(by[String(r.staff)] ??= []).push(Number(r.law_id))
      if (String(r.staff) === me) signed[Number(r.law_id)] = String(r.signed_at)
    }
    const mk = await sql`SELECT law_id, staff, score, total, law_hash FROM law_quiz_marks WHERE staff = ANY(${SIGNERS})`.catch(() => [])
    const marks: Record<string, Record<number, string>> = {}
    for (const r of mk) if (hashes.get(Number(r.law_id)) === r.law_hash) (marks[String(r.staff)] ??= {})[Number(r.law_id)] = `${r.score}/${r.total}`
    return success({ signed, marks, me, signer, total: live.length, unsigned: signer ? live.length - Object.keys(signed).length : 0, staff: SIGNERS, by })
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
    if (!SIGNERS.includes(me)) return badRequest('You are not on the list of people who sign the laws.')
    const rows = await sql`SELECT id, md5(coalesce(text,'') || '|' || coalesce(dos,'') || '|' || coalesce(donts,'')) AS h FROM page_laws WHERE status = 'live' AND id = ANY(${ids})`
    for (const r of rows) await sql`INSERT INTO law_signatures (law_id, staff, law_hash) VALUES (${r.id}, ${me}, ${r.h}) ON CONFLICT (law_id, staff) DO UPDATE SET law_hash = ${r.h}, signed_at = now()`
    return success({ signed: rows.length })
  } catch (e) { return handleError('law-signatures POST', e) }
}
