import { requireAuth, success, handleError, unauthorized } from '@/lib/api'
import { ensureDbInitialized } from '@/lib/api/dbInitCache'
import sql from '@/lib/db'
import { ensurePageLawsTable } from '@/lib/pageLaws'
import { once } from '@/lib/once'

const ensureCustomTasksTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS custom_tasks (
      id SERIAL PRIMARY KEY,
      title TEXT NOT NULL,
      notes TEXT,
      due_date DATE,
      submenu TEXT,
      view TEXT,
      done BOOLEAN NOT NULL DEFAULT false,
      created_by TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `.catch(() => {})
})

// Backs the global "⚖️ Laws & Tasks" icon -- every page (Items, Sales,
// Bills, Team Times, a Manage category, a submenu, ...) has always kept its
// own rules/tasks under its own scope_key, with no single list of which
// scope_keys actually exist anywhere. This is that list: every scope that
// has at least one law or one unattached task, with counts so the global
// modal can show "(3)" next to a page's name before you expand it, instead
// of listing every page in the app whether it has anything or not.
export async function GET() {
  const { error } = await requireAuth()
  if (error) return unauthorized()

  try {
    await ensureDbInitialized()
    await ensurePageLawsTable()
    await ensureCustomTasksTable()
    const [lawCounts, taskCounts] = await Promise.all([
      sql`SELECT scope_key AS scope, COUNT(*)::int AS count FROM page_laws GROUP BY scope_key`,
      // Only unattached ("global") tasks -- one tied to a law_id/flag_key is
      // already counted as part of that law when its own scope is opened,
      // same as PageLawsList's own "global tasks" section within one scope.
      sql`SELECT submenu AS scope, COUNT(*)::int AS count FROM custom_tasks WHERE submenu IS NOT NULL AND law_id IS NULL AND flag_key IS NULL GROUP BY submenu`,
    ])

    const byScope = new Map<string, { scope: string; lawCount: number; taskCount: number }>()
    for (const r of lawCounts as any[]) {
      byScope.set(r.scope, { scope: r.scope, lawCount: r.count, taskCount: 0 })
    }
    for (const r of taskCounts as any[]) {
      const existing = byScope.get(r.scope)
      if (existing) existing.taskCount = r.count
      else byScope.set(r.scope, { scope: r.scope, lawCount: 0, taskCount: r.count })
    }

    const rows = Array.from(byScope.values()).sort((a, b) => a.scope.localeCompare(b.scope))
    return success(rows)
  } catch (e) {
    return handleError('law-scopes GET', e)
  }
}
