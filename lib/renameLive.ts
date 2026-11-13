import sql from '@/lib/db'

// The owner renamed "Items / Live Sale" (and "Live Sale") to "Live" (2026-11-13). The words stored in the database (laws, their tiles, group questions, a renamed sidebar label)
// follow once. The video's own chapter title still says "Live Sale", so the link to it is matched in code, not here.
export async function renameLiveOnce() {
  try {
    const c = await sql`INSERT INTO law_migrations (key) VALUES ('rename-live-2026-11-13') ON CONFLICT DO NOTHING RETURNING key`
    if (!c.length) return
    const fix = (col: string) => `${col} = REPLACE(REPLACE(REPLACE(${col}, 'Items / Live Sale', 'Live'), 'Live Sale''s', 'Live''s'), 'Live Sale', 'Live')`
    await sql.query(`UPDATE page_laws SET ${fix('text')}, ${fix('title')}, ${fix('dos')}, ${fix('donts')}, ${fix('violations')}, ${fix('not_violation')} WHERE CONCAT(text, title, dos, donts, violations, not_violation) LIKE '%Live Sale%'`)
    await sql.query(`UPDATE daily_check_tiles SET ${fix('title')}, ${fix('how')}, ${fix('ask')} WHERE CONCAT(title, how, ask) LIKE '%Live Sale%'`)
    await sql.query(`UPDATE question_group_items SET ${fix('text')} WHERE text LIKE '%Live Sale%'`).catch(() => {})
    await sql.query(`UPDATE pane_labels SET label = 'Live' WHERE label IN ('Items / Live Sale', 'Live Sale')`).catch(() => {})
  } catch (e) { console.error('rename Live failed:', e instanceof Error ? e.message : String(e)) }
}
