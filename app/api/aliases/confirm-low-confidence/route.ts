import { requireAuth, getActorName, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

// A reviewer confirming, from the Alias Wide Table's own badge, that an
// alias resolved by best-guess price/name heuristics (see the 78-pair
// prezoho disambiguation pass, source='prezoho_bulk_low_confidence') really
// does point at the right item. Only flips that one alias row's source back
// to plain 'prezoho_bulk' -- it never touches the item itself, so this is
// safe to call even if other aliases on the same item are still flagged.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { aliasId } = await req.json() as { aliasId: number }
  if (!aliasId) return badRequest('Missing aliasId')

  const actor = getActorName(session)
  const [row] = await sql`
    UPDATE item_aliases SET source = 'prezoho_bulk'
    WHERE id = ${aliasId} AND source = 'prezoho_bulk_low_confidence'
    RETURNING id, alias_name
  ` as { id: number; alias_name: string }[]

  if (row) await logActivity(actor, 'confirmed alias match as correct', row.alias_name)
  return success({ ok: true })
}
