import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

// Bino's own end-of-day checklist against the Advert rules -- shown each
// time he clocks out (see StaffClient's BinoChecklistModal), one row per
// day, so there's a record of what he says he did that day.
async function ensureTable() {
  await sql`
    CREATE TABLE IF NOT EXISTS bino_daily_checklist (
      id SERIAL PRIMARY KEY,
      work_date DATE NOT NULL UNIQUE,
      advert_new BOOLEAN NOT NULL DEFAULT FALSE,
      advert_low_performing BOOLEAN NOT NULL DEFAULT FALSE,
      advert_trending BOOLEAN NOT NULL DEFAULT FALSE,
      equipment_checked BOOLEAN NOT NULL DEFAULT FALSE,
      jingle_recorded BOOLEAN NOT NULL DEFAULT FALSE,
      files_named BOOLEAN NOT NULL DEFAULT FALSE,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    await ensureTable()
    const today = new Date().toISOString().slice(0, 10)
    const [row] = await sql`SELECT * FROM bino_daily_checklist WHERE work_date = ${today}`
    return NextResponse.json(row ?? null)
  } catch (e) {
    console.error('bino-checklist GET error:', e)
    return NextResponse.json(null)
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { advert_new, advert_low_performing, advert_trending, equipment_checked, jingle_recorded, files_named, notes } = await req.json()
  const username = (session.user as any)?.username || session.user?.name || 'Unknown'
  const today = new Date().toISOString().slice(0, 10)

  try {
    await ensureTable()
    await sql`
      INSERT INTO bino_daily_checklist
        (work_date, advert_new, advert_low_performing, advert_trending, equipment_checked, jingle_recorded, files_named, notes)
      VALUES
        (${today}, ${!!advert_new}, ${!!advert_low_performing}, ${!!advert_trending}, ${!!equipment_checked}, ${!!jingle_recorded}, ${!!files_named}, ${notes || null})
      ON CONFLICT (work_date) DO UPDATE SET
        advert_new = ${!!advert_new}, advert_low_performing = ${!!advert_low_performing},
        advert_trending = ${!!advert_trending}, equipment_checked = ${!!equipment_checked},
        jingle_recorded = ${!!jingle_recorded}, files_named = ${!!files_named}, notes = ${notes || null}
    `
    const doneCount = [advert_new, advert_low_performing, advert_trending, equipment_checked, jingle_recorded, files_named].filter(Boolean).length
    await logActivity(username, 'submitted Advert daily checklist', `${doneCount}/6 done`)
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('bino-checklist POST error:', e)
    return NextResponse.json({ error: 'Could not save checklist' }, { status: 500 })
  }
}
