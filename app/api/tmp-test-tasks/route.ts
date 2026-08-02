import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// Exercises the exact same INSERT/UPDATE/DELETE the real /api/tasks and
// /api/tasks/[id] routes run, across three different submenus (pages), then
// cleans up after itself so no test rows are left behind.
export async function POST() {
  const submenus = ['Items', 'Counts', 'Sales']
  const created: { id: number; submenu: string }[] = []

  for (const submenu of submenus) {
    const [row] = await sql`
      INSERT INTO custom_tasks (title, notes, due_date, submenu, view, created_by)
      VALUES (${'TMP TEST TASK — ' + submenu}, ${'diagnostic round-trip test'}, NULL, ${submenu}, NULL, 'diagnostic')
      RETURNING id, title, submenu, done
    `
    created.push({ id: row.id, submenu: row.submenu })
  }

  // Toggle the first one done, matching the real PUT .../[id] route's shape
  const [toggled] = await sql`
    UPDATE custom_tasks SET done = true, completed_at = NOW()
    WHERE id = ${created[0].id}
    RETURNING id, done, completed_at
  `

  const readBack = await sql`
    SELECT id, title, submenu, done FROM custom_tasks WHERE id = ANY(${created.map(c => c.id)}) ORDER BY id
  `

  // Delete all three, matching the real DELETE .../[id] route
  for (const c of created) {
    await sql`DELETE FROM custom_tasks WHERE id = ${c.id}`
  }

  const afterDelete = await sql`SELECT id FROM custom_tasks WHERE id = ANY(${created.map(c => c.id)})`

  return NextResponse.json({ created, toggled, readBack, afterDelete })
}
