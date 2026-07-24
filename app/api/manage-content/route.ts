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

A Home button plus two tabs across the top: Grony Cash, Grony Manage.

## Home
Just the news feed -- announcements, photos, and voice notes. Post a message here to keep everyone informed. Flags live in the role bar at the very bottom of the screen instead (see below), so the feed is always the first thing you see.

## Grony Cash
Everything to do with money. Top row: Items, Sales, Bills, Daily Loss, Expenses, PO, P&L (owner and Joe only), CAB, Daily, Data.
- Items (Goods & Services) -- the shop's stock list. Tap an item's name to open its Item 360 page: stock/history stats plus the same pack-chain loss/gain detail, editing, aliases, matches, and merge tools that used to open inline here.
- Sales -- every sales receipt (WIC = Walk-In Customer, GMC = Grony Multimedia as Customer, i.e. internal use, not a real sale).
- Bills -- what the shop has bought from vendors.
- Daily Loss -- loss/gain records feed, with its own trend charts.
- Expenses -- money spent.
- PO (Purchase Orders) -- a request sent to a vendor for goods not yet received, separate from a Bill (which records a purchase already made). Draft it, Send it, then Receive Items against it as deliveries actually arrive -- partial deliveries are fine, each "Receive Items" batch creates a real Bill for exactly what showed up that time, so a PO can be received across several dates before every line is fully accounted for. Cancel a draft or sent PO any time before it's fully received; a draft with nothing received yet can also be deleted outright.
- P&L -- Profit & Loss.
- CAB -- Cash at Bank reconciliation.
- Daily -- the end-of-day report (see "Daily Summary" below). Not the same thing as Daily Loss above -- Daily Loss is the ongoing loss/gain feed, Daily is one report per day.
- Data -- analytics and charts across Items, Violations, Loss, Sales, Bills, Counts, Expenses, and Cash.
- Customers, Receipts, Vendors, and Counts aren't in this tab any more -- they're one tap away from the account menu (person icon, bottom right) instead. Counts isn't a daily-glance destination any more anyway -- the actual daily-count flow is already surfaced via Joe's flags and the Opener's own clock-in step.

## Grony Manage
Everything that isn't directly about money:
- Staff -- clock in and out here, and see the staff rota (see "Clocking In/Out" below).
- Advert -- Bino is in charge, the same way Joe is in charge of Grony Manage overall, so Bino is the default assignee shown on Advert (and other Grony Manage) flags. Nine sub-tabs: Audio (the rules), Advert Status (mark each item/service as having an audio advert or not -- missing ones become a flag), Jingle Log (at least one new jingle a month, or it flags), Equipment Check (Amplifier/Speaker/wires confirmed every Monday & Thursday, or it flags), Photoshop/WhatsApp/Cuttings/Video (their own rules, matching the shop's Google Drive advert folders), and Daily Log (pulled from the Closer's end-of-day questionnaire -- was the roadside advert played today).
- Dress Code -- pulled from the Closer's end-of-day questionnaire.
- Arrangement, Cleanliness, Future, Customer Display, Staff Display, Repair Works, Quality Assurance -- simple day-to-day logs; add a note (and a photo if useful) whenever something in that category happens.
- Training -- this page, plus Company Laws and Assessment.
- Logs -- the activity log.

## Daily Summary
A single end-of-day report: who worked, what was counted, what WIC and GMC bought that day, whether each sale was recorded correctly, Work Not Written, and the day's Profit/Loss. Downloadable as a PDF.

# The Role Bar

A row of four buttons fixed to the bottom of the screen, always visible: Joe, Bino, Opener, Closer. A red number next to a name means outstanding issues -- tap it to see the list and jump straight to fixing them.
- Joe -- Grony Cash flags, plus the loss summaries (all-time, yesterday, week, month, year).
- Bino -- Grony Manage flags.
- Opener -- shows if today's Opener still hasn't confirmed the opening counts, so it can be finished from anywhere, not just at clock-in.
- Closer -- shows any past day that ended without a closing report being submitted.

# Clocking In/Out, the Opener and Closer

- Clock in/out under Grony Manage > Staff. Location must be enabled -- you must be at the shop.
- The Opener is whoever clocks in earliest each day, marked 🌅. The Closer is the last to clock out, marked 🌙, and must answer a short closing questionnaire before their clock-out is accepted.
- The Opener's clock-in time is saved the moment they tap Clock In -- that part never changes. But the clock-in isn't fully complete until the Opener confirms that day's opening counts are done: a card stays on screen reminding them, with "Go to Counts →" and "I've Completed the Counts" buttons, until they confirm.
- The opening counts are the shop's fixed daily-count item list. For A4 Brown Envelope, A4 Lamination and 4x6, counting the singles also requires counting their paired pack the same day (you're prompted for it right there) -- so completing the daily list covers those packs too. A4 Sheet's pack pairing stays optional and isn't required.

# The Account Menu

The 👤 button, at the bottom right of the Role Bar (shows who's logged in), holds account-level actions and a few shortcuts: View Portal As (owner and Joe only -- lets you see the app as a specific staff member), Users, Profile, Customers, Receipts, Vendors, Counts, Alias Wide Table, Service Matches, and Sign out (plus Personal and Fix Mislinked Sales for owner-level users).

# Roles

- Staff -- the default role. Can clock in/out, enter sales/bills/expenses, do counts, and use most of the app.
- Manager -- can additionally delete posts and see certain confidential entries.
- Owner (and Joe, who holds the same rights as the owner) -- the only ones who can see P&L, confidential expenses like Salaries, use View Portal As, and edit this Tutorial and the Company Laws page.

# A Few Things Worth Knowing

- WIC vs GMC: WIC is a real paying customer walking in. GMC means the shop itself is the "customer" -- stock taken for internal use, not a sale.
- Flags cover every kind of thing that needs attention -- missing prices, duplicate items, unlinked sales, outstanding daily counts, and more. Clearing them keeps the shop's numbers accurate. Tapping "Fix now →" on a flag jumps straight to it.
- Every item a WIC customer buys should be counted the next day, to confirm the stock actually dropped as expected.
- Anyone can check Bino's outstanding Grony Manage tasks from the Bino tab on the Role Bar -- same as everyone else's. He's also asked to tick off his Advert checklist each time he clocks out.`,
  training_laws: `# Company Laws

No company policies have been added here yet -- the owner will add them.`,
  // Grony Manage > Advert sub-tabs -- one per category in the shop's Google
  // Drive advert folder structure (1) ADVO - Advert 1..5). Each holds the
  // rules for that advert category once the owner adds them.
  advert_audio_roadside: `# Advert 1 — Audio (for Roadside)

Bino is in charge of Advert, the same way Joe is in charge of Grony Manage overall.

## Rules

- Every service or item at the shop must have its advert recorded. Anything missing one shows up on the Advert Status tab and as a flag until it's recorded.
- Any trending service must have its advert recorded.
- Low-performing services or goods must have adverts recorded for them -- an advert is part of how a slow seller gets a push.
- Every Monday and Thursday, confirm the Amplifier, Speaker, and wires are in good condition and playing fine, using the Equipment Check tab. A missed check becomes a flag.
- At least one new jingle must be recorded every month, logged on the Jingle Log tab. A month with none recorded becomes a flag.
- Files in the audio folder must be named properly, by the actual service name -- not a generic or placeholder name.

## Where to work

- Advert Status -- mark each item/service as advert-recorded or missing.
- Jingle Log -- log each new jingle as it's recorded.
- Equipment Check -- log the Monday/Thursday amplifier/speaker/wires confirmation.`,
  advert_photo_photoshop: `# Advert 2 — Photo (Photoshop Files)

No rules have been added here yet -- the owner will add them.`,
  advert_photo_whatsapp: `# Advert 3 — Photo (WhatsApp Advert)

No rules have been added here yet -- the owner will add them.`,
  advert_photo_cuttings: `# Advert 4 — Photo (Cuttings)

No rules have been added here yet -- the owner will add them.`,
  advert_video: `# Advert 5 — Video Advert

No rules have been added here yet -- the owner will add them.`,
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
