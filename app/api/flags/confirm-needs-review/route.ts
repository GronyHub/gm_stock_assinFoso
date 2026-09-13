import { requireAuth, getActorName, badRequest, success } from '@/lib/api'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest } from 'next/server'

// A reviewer confirming, from Item 360's own "Needs Review" banner, that a
// stub item created from an unidentified pre-Zoho ledger name (see
// /api/aliases/wide) really is its own standalone product. Only clears the
// plain needs_review boolean -- cf_group already holds the item's real
// category (assigned when the stub was created) and is never touched here,
// so "correct" really does mean "no change" beyond dropping out of the
// review queue. The WHERE guard makes this safe to call twice.
export async function POST(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error

  const { itemId } = await req.json() as { itemId: number }
  if (!itemId) return badRequest('Missing itemId')

  const actor = getActorName(session)
  const [row] = await sql`
    UPDATE items SET needs_review = false
    WHERE id = ${itemId} AND needs_review = true
    RETURNING id, canonical_name
  ` as { id: number; canonical_name: string }[]

  if (row) await logActivity(actor, 'confirmed item as correct (cleared Needs Review)', row.canonical_name)
  return success({ ok: true })
}
