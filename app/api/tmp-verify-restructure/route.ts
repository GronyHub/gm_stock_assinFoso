import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// One-shot fix for the single stranded page_notes row found under the old
// 'Staff Meeting' scope key -- re-points it at the renamed 'Team Meeting'
// scope so it's visible again under the new pane label. Idempotent: a
// second call finds nothing left to move.
export async function POST() {
  try {
    const moved = await sql`
      UPDATE page_notes SET scope_key = 'Team Meeting'
      WHERE scope_key = 'Staff Meeting'
      RETURNING scope_key, kind
    `
    return NextResponse.json({ ok: true, moved })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function GET() {
  try {
    const fixedCategories = await sql`
      SELECT id, label FROM manage_categories
      WHERE label IN ('Unfortunate Events', 'Security chk', 'Staff Payments', 'App info')
    `

    const ukSubmenuCounts = await sql`
      SELECT person, COUNT(*)::int AS n FROM uk_submenus
      WHERE person IN ('Fiifi','Kuukua','Ebo','Odoye')
      GROUP BY person
    `
    const ukSubmenuNames = await sql`
      SELECT person, name FROM uk_submenus
      WHERE person IN ('Fiifi','Kuukua','Ebo','Odoye')
      ORDER BY person, name
    `
    const ukColumnCounts = await sql`
      SELECT s.person, s.name, COUNT(c.id)::int AS column_count
      FROM uk_submenus s LEFT JOIN uk_columns c ON c.submenu_id = s.id
      WHERE s.person IN ('Fiifi','Kuukua','Ebo','Odoye')
      GROUP BY s.person, s.name
      ORDER BY s.person, s.name
    `
    const ukRowCounts = await sql`
      SELECT s.person, s.name, s.id AS submenu_id, COUNT(r.id)::int AS row_count
      FROM uk_submenus s LEFT JOIN uk_rows r ON r.submenu_id = s.id
      WHERE s.person IN ('Fiifi','Kuukua','Ebo','Odoye')
      GROUP BY s.person, s.name, s.id
      ORDER BY s.person, s.name
    `
    const orphanedCells = await sql`
      SELECT COUNT(*)::int AS n FROM uk_cells c
      LEFT JOIN uk_rows r ON r.id = c.row_id
      WHERE r.id IS NULL
    `

    const oldLabels = ['Dress Code','Staff Display','Staff Meeting','Tutorial','Company Laws','Assessment','Rota','Logs']
    const customTasksUnderOldNames = await sql`
      SELECT id, title, submenu, done FROM custom_tasks WHERE submenu = ANY(${oldLabels})
    `
    const pageNotesUnderOldNames = await sql`
      SELECT scope_key, kind, notes, updated_at FROM page_notes WHERE scope_key = ANY(${oldLabels})
    `

    const rolePermAddCategory = await sql`SELECT * FROM role_permissions WHERE feature_key = 'add_category'`
    const userPermAddCategory = await sql`SELECT * FROM user_permissions WHERE feature_key = 'add_category'`

    return NextResponse.json({
      fixedCategories,
      ukSubmenuCounts, ukSubmenuNames, ukColumnCounts, ukRowCounts, orphanedCells,
      customTasksUnderOldNames, pageNotesUnderOldNames,
      rolePermAddCategory, userPermAddCategory,
    })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
