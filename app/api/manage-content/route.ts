import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import { NextRequest } from 'next/server'
import { once } from '@/lib/once'

// Simple key/value content pages for Grony Manage > Training (Tutorial and
// Company Laws). Anyone logged in can read; only owner-level (Grony/Joe) can
// edit, matching the confidential/administrative gating used elsewhere.
const ensureManageContent = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS manage_content (
      key TEXT PRIMARY KEY,
      body TEXT NOT NULL,
      updated_by TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
})

// Fallback text shown until someone saves a real version -- keeps the page
// useful immediately after deploy, before any DB row exists.
//
// training_tutorial used to be the default text here (the general
// app-orientation guide, shown on the old "My Training"/"Team Tutorial"
// pages) -- that content moved into the Help Guide's own "Getting Started"
// group instead, rewritten there to match the app's current layout (this
// version had drifted -- it still described a "Home button plus Grony Cash/
// Grony Manage tabs" layout the app no longer has). Both pages that used to
// show this key are gone; nothing reads it any more.
const DEFAULTS: Record<string, string> = {
  training_laws: `# Company Laws

No company policies have been added here yet -- the owner will add them.`,
  // Staff > Times -- company policy specifically about time-keeping
  // (lateness, overtime, clocking rules, etc.), separate from the general
  // Company Laws above since that one isn't time-specific.
  staff_times_laws: `# Company Laws — Time

No time-related policies have been added here yet -- the owner will add them.`,
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
  const { error } = await requireAuth()
  if (error) return error

  const key = req.nextUrl.searchParams.get('key')
  if (!key) return badRequest('Missing key')

  try {
    await ensureDbInitialized()
    await ensureManageContent()
    const [row] = await sql`SELECT key, body, updated_by, updated_at FROM manage_content WHERE key = ${key}`
    if (row) return success(row)
    return success({ key, body: DEFAULTS[key] ?? '', updated_by: null, updated_at: null })
  } catch (e) {
    console.error('manage-content GET error:', e)
    return success({ key, body: DEFAULTS[key] ?? '', updated_by: null, updated_at: null })
  }
}

export async function PUT(req: NextRequest) {
  const { session, error } = await requireAuth()
  if (error) return error
  if (!isOwnerLevel(session?.user as any)) {
    return badRequest('Only the owner or Joe can edit this page')
  }

  const { key, body } = await req.json()
  if (!key || typeof body !== 'string') return badRequest('Missing key or body')

  const updatedBy = (session?.user as any)?.username || session?.user?.name || 'Unknown'

  try {
    await ensureDbInitialized()
    await ensureManageContent()
    await sql`
      INSERT INTO manage_content (key, body, updated_by, updated_at)
      VALUES (${key}, ${body}, ${updatedBy}, now())
      ON CONFLICT (key) DO UPDATE SET body = ${body}, updated_by = ${updatedBy}, updated_at = now()
    `
    return success({ ok: true })
  } catch (e) {
    return handleError('manage-content PUT', e)
  }
}
