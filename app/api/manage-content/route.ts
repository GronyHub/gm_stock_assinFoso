import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

// Simple key/value content pages for Grony Manage > Training (Tutorial and
// Company Laws). Anyone logged in can read; only owner-level (Grony/Joe) can
// edit, matching the confidential/administrative gating used elsewhere.
async function ensureManageContent() {
  await sql`
    CREATE TABLE IF NOT EXISTS manage_content (
      key TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
}

// Fallback text shown until someone saves a real version -- keeps the page
// useful immediately after deploy, before any DB row exists. The Tutorial
// default is maintained here going forward as the app changes.
const DEFAULTS: Record<string, string> = {
  training_tutorial: `# Welcome to the Grony Multimedia App

This app is how Grony Multimedia tracks sales, stock, money, and daily operations. This guide explains how it's organized so you can find what you need quickly.

# The Main Tabs

A Home button plus three tabs across the top: Grony Cash, Grony Manage, Daily.

## Home
- Flags -- one combined list of everything needing attention, cash and non-cash together. Each flag has a "Fix now →" link that jumps straight to it.
- News feed -- announcements, photos, and voice notes, below the flags. Post a message here to keep everyone informed.

## Grony Cash
Everything to do with money. Top row: Items, Sales, Bills, Expenses, Data, P&L (owner and Joe only), CAB.
- Items -- the shop's stock list, with pack-chain loss/gain tracking. Has its own sub-row: Counts, Feed, and 💲 Prices / 🔻 Loss Only / 🔺 Gain Only toggles for the pack-chain detail table.
- Sales -- every sales receipt (WIC = Walk-In Customer, GMC = Grony Multimedia as Customer, i.e. internal use, not a real sale). Has its own sub-row: Customers, Receipts.
- Bills -- what the shop has bought from vendors. Has its own sub-row: Vendors.
- Counts -- physical stock counts (also reachable as a child of Items).
- Data -- analytics and charts.
- Expenses -- money spent.
- P&L -- Profit & Loss.
- CAB -- Cash at Bank reconciliation.

## Grony Manage
Everything that isn't directly about money:
- Staff -- clock in and out here, and see the staff rota (see "Clocking In/Out" below).
- Advert / Dress Code -- pulled from the Closer's end-of-day questionnaire.
- Properties -- the shop's tracked physical assets.
- Arrangement, Cleanliness, Future, Customer Display, Staff Display, Repair Works, Quality Assurance -- simple day-to-day logs; add a note (and a photo if useful) whenever something in that category happens.
- Training -- this page, plus Company Laws and Assessment.
- Logs -- the activity log.

## Daily Summary
A single end-of-day report: who worked, what was counted, what WIC and GMC bought that day, whether each sale was recorded correctly, Work Not Written, and the day's Profit/Loss. Downloadable as a PDF.

# Clocking In/Out, the Opener and Closer

- Clock in/out under Grony Manage > Staff. Location must be enabled -- you must be at the shop.
- The Opener is whoever clocks in earliest each day, marked 🌅. The Closer is the last to clock out, marked 🌙, and must answer a short closing questionnaire before their clock-out is accepted.
- The Opener's clock-in time is saved the moment they tap Clock In -- that part never changes. But the clock-in isn't fully complete until the Opener confirms that day's opening counts are done: a card stays on screen reminding them, with "Go to Counts →" and "I've Completed the Counts" buttons, until they confirm.
- The opening counts are the shop's fixed daily-count item list. For A4 Brown Envelope, A4 Lamination and 4x6, counting the singles also requires counting their paired pack the same day (you're prompted for it right there) -- so completing the daily list covers those packs too. A4 Sheet's pack pairing stays optional and isn't required.

# The Hamburger Menu

The ☰ button, fixed to the bottom-left corner of the screen, holds account-level actions: View Portal As (owner and Joe only -- lets you see the app as a specific staff member), Users, Profile, and Sign out (plus Personal and Fix Mislinked Sales for owner-level users).

# Roles

- Staff -- the default role. Can clock in/out, enter sales/bills/expenses, do counts, and use most of the app.
- Manager -- can additionally delete posts and see certain confidential entries.
- Owner (and Joe, who holds the same rights as the owner) -- the only ones who can see P&L, confidential expenses like Salaries, use View Portal As, and edit this Tutorial and the Company Laws page.

# A Few Things Worth Knowing

- WIC vs GMC: WIC is a real paying customer walking in. GMC means the shop itself is the "customer" -- stock taken for internal use, not a sale.
- Flags cover every kind of thing that needs attention -- missing prices, duplicate items, unlinked sales, outstanding daily counts, and more. Clearing them keeps the shop's numbers accurate. Tapping "Fix now →" on a flag jumps straight to it.
- Every item a WIC customer buys should be counted the next day, to confirm the stock actually dropped as expected.`,
  training_laws: `# Company Laws

No company policies have been added here yet -- the owner will add them.`,
}

export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return NextResponse.json({ error: 'Missing key' }, { status: 400 })

  try {
    await ensureManageContent()
    const [row] = await sql`SELECT key, body, updated_by, updated_at FROM manage_content WHERE key = ${key}`
    if (row) return NextResponse.json(row)
    return NextResponse.json({ key, body: DEFAULTS[key] ?? '', updated_by: null, updated_at: null })
  } catch (e) {
    console.error('manage-content GET error:', e)
    return NextResponse.json({ key, body: DEFAULTS[key] ?? '', updated_by: null, updated_at: null })
  }
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  if (!isOwnerLevel(session?.user as any)) {
    return NextResponse.json({ error: 'Only the owner or Joe can edit this page' }, { status: 403 })
  }

  const { key, body } = await req.json()
  if (!key || typeof body !== 'string') return NextResponse.json({ error: 'Missing key or body' }, { status: 400 })

  const updatedBy = (session!.user as any)?.username || session!.user?.name || 'Unknown'

  try {
    await ensureManageContent()
    await sql`
      INSERT INTO manage_content (key, body, updated_by, updated_at)
      VALUES (${key}, ${body}, ${updatedBy}, now())
      ON CONFLICT (key) DO UPDATE SET body = ${body}, updated_by = ${updatedBy}, updated_at = now()
    `
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('manage-content PUT error:', e)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
}
