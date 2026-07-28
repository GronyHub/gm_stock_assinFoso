import sql from '@/lib/db'

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
}
