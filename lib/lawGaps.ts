import sql from '@/lib/db'

// Older laws were written before every law needed a short title and at least one violation line. This fills those gaps once, so every law reads the same way:
//  - title: the first part of the law's own words;
//  - violation: a recurring law is broken when its task is not done and ticked (Waiting for team records it and a missed task costs a point at day end);
//    a standing law is broken when a manager sees it not being followed and logs it (1 point, with a note);
//    an app-checked law is broken when the app finds it.
// The owner can edit any of them in Company Laws. Nothing that already has a title or violation is changed.
export function deriveTitle(text: string): string {
  let t = text.replace(/\s+/g, ' ').trim()
  t = t.split(/(?<=[.!?])\s|[:;]|\s-\s|\s—\s/)[0] ?? t
  t = t.replace(/[.:;,\-\s]+$/, '')
  if (t.length > 90) { t = t.slice(0, 90); t = t.slice(0, t.lastIndexOf(' ') > 50 ? t.lastIndexOf(' ') : 90).replace(/[.:;,\-\s]+$/, '') }
  return t.charAt(0).toUpperCase() + t.slice(1)
}

export function deriveViolation(law: { text: string; law_type: string | null }, title: string) {
  const text = law.text.replace(/\s+/g, ' ').trim()
  if (law.law_type === 'recurring') return [{ text: `The task is not done and ticked in Waiting for team at its time: ${title}`.slice(0, 300), points: 1, by: 'app', how: text.slice(0, 700), record: 'Waiting for team records it; a task left undone costs a point at the end of the day' }]
  if (law.law_type === 'app') return [{ text: `The app finds that this law was not followed: ${title}`.slice(0, 300), points: 1, by: 'app', how: text.slice(0, 700), record: 'The app checks it itself and adds the point' }]
  return [{ text: `A staff member does not follow this law: ${title}`.slice(0, 300), points: 1, by: 'manager', how: text.slice(0, 700), record: 'A manager sees it in the shop or on CCTV and logs it with a note' }]
}

export async function fillLawGapsOnce() {
  try {
    await sql`CREATE TABLE IF NOT EXISTS law_migrations (key TEXT PRIMARY KEY, done_at TIMESTAMPTZ NOT NULL DEFAULT now())`
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('fill-law-gaps-v1') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const rows = await sql`SELECT id, text, law_type, title, violations FROM page_laws
      WHERE status IN ('live', 'draft') AND ((title IS NULL OR title = '') OR (violations IS NULL OR violations = '' OR violations = '[]'))` as unknown as { id: number; text: string; law_type: string | null; title: string | null; violations: string | null }[]
    for (const r of rows) {
      const title = r.title && r.title.trim() ? r.title : deriveTitle(r.text)
      const hasV = r.violations && r.violations !== '[]' && r.violations.trim() !== ''
      if (!r.title || !r.title.trim()) await sql`UPDATE page_laws SET title = ${title} WHERE id = ${r.id}`
      if (!hasV) await sql`UPDATE page_laws SET violations = ${JSON.stringify(deriveViolation(r, title))} WHERE id = ${r.id}`
    }
  } catch (e) { console.error('fill law gaps failed:', e instanceof Error ? e.message : String(e)) }
}
