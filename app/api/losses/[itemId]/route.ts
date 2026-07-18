import { ensureCountRevisions } from '@/lib/countRevisions'
import { getItemDayRows } from '@/lib/itemDayRows'
import { NextResponse } from 'next/server'

export async function GET(_req: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const { itemId } = await params
  const id = Number(itemId)

  // The main query joins stock_count_revisions, which is created lazily.
  await ensureCountRevisions()

  const rows = await getItemDayRows(id)

  return NextResponse.json(rows)
}
