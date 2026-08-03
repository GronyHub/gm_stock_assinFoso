import sql from '@/lib/db'

// Fixed set of log categories for each child -- see ukViewData.ts's
// UK_PEOPLE, which these `person` values must match exactly. Submenus are
// otherwise "fixed from the UI's side" (no self-service add), so this is
// how they get created instead: seeded once, idempotently, rather than by
// hand through the app.
const CHILD_LOG_CATEGORIES = [
  'Health', 'Education', 'Behaviour', 'Clothing',
  'House Chores', 'Utterances', 'Church Activities', 'Future Career',
]
const LOG_CHILDREN = ['Fiifi', 'Kuukua', 'Ebo', 'Odoye']

async function ensureChildLogSubmenus() {
  const rows: { person: string; name: string; sort_order: number }[] = []
  for (const person of LOG_CHILDREN) {
    CHILD_LOG_CATEGORIES.forEach((category, i) => rows.push({ person, name: `${person} ${category}`, sort_order: i }))
  }
  const values = rows.map((_, i) => `($${i * 3 + 1}::text, $${i * 3 + 2}::text, $${i * 3 + 3}::int)`).join(', ')
  const params = rows.flatMap(r => [r.person, r.name, r.sort_order])
  // Single round trip: insert whichever of the 32 (person, name) pairs
  // don't already exist yet. No unique constraint on uk_submenus to lean
  // on, so the "already there?" check is spelled out with WHERE NOT EXISTS
  // instead of ON CONFLICT.
  await sql.query(`
    INSERT INTO uk_submenus (person, name, sort_order)
    SELECT v.person, v.name, v.sort_order FROM (VALUES ${values}) AS v(person, name, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM uk_submenus s WHERE s.person = v.person AND s.name = v.name)
  `, params).catch(() => {})
}

// Columns can no longer be self-service added either, so a seeded submenu
// with zero columns would be a dead end -- nothing to log against and no
// button left to fix it. Date + Notes is generic enough to cover any of
// the eight categories (a health note, a school note, a quoted utterance,
// ...).
const CHILD_LOG_COLUMNS = ['Date', 'Notes']

async function ensureChildLogColumns() {
  const submenus = await sql`
    SELECT id, person, name FROM uk_submenus WHERE person = ANY(${LOG_CHILDREN})
  ` as { id: number; person: string; name: string }[]
  const relevant = submenus.filter(s => CHILD_LOG_CATEGORIES.some(category => s.name === `${s.person} ${category}`))
  if (relevant.length === 0) return

  const rows: { submenu_id: number; name: string; sort_order: number }[] = []
  for (const s of relevant) {
    CHILD_LOG_COLUMNS.forEach((name, i) => rows.push({ submenu_id: s.id, name, sort_order: i }))
  }
  const values = rows.map((_, i) => `($${i * 3 + 1}::int, $${i * 3 + 2}::text, $${i * 3 + 3}::int)`).join(', ')
  const params = rows.flatMap(r => [r.submenu_id, r.name, r.sort_order])
  await sql.query(`
    INSERT INTO uk_columns (submenu_id, name, sort_order)
    SELECT v.submenu_id, v.name, v.sort_order FROM (VALUES ${values}) AS v(submenu_id, name, sort_order)
    WHERE NOT EXISTS (SELECT 1 FROM uk_columns c WHERE c.submenu_id = v.submenu_id AND c.name = v.name)
  `, params).catch(() => {})
}

// Shared by every /api/uk/* route -- uk_columns' FK needs uk_submenus to
// already exist, so both are created here in order rather than each route
// creating only its own table.
export async function ensureUkTables() {
  await sql`
    CREATE TABLE IF NOT EXISTS uk_submenus (
      id SERIAL PRIMARY KEY,
      person TEXT NOT NULL,
      name TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS uk_columns (
      id SERIAL PRIMARY KEY,
      submenu_id INT NOT NULL REFERENCES uk_submenus(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS uk_rows (
      id SERIAL PRIMARY KEY,
      submenu_id INT NOT NULL REFERENCES uk_submenus(id) ON DELETE CASCADE,
      sort_order INT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `.catch(() => {})
  await sql`
    CREATE TABLE IF NOT EXISTS uk_cells (
      row_id INT NOT NULL REFERENCES uk_rows(id) ON DELETE CASCADE,
      column_id INT NOT NULL REFERENCES uk_columns(id) ON DELETE CASCADE,
      value TEXT NOT NULL DEFAULT '',
      PRIMARY KEY (row_id, column_id)
    )
  `.catch(() => {})
  await ensureChildLogSubmenus()
  await ensureChildLogColumns()
}
