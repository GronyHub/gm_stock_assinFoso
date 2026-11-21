import sql from '@/lib/db'

// The manager's "have you recorded everything?" checks: expenses every login, bills every Tuesday and Friday.
// Every answer (yes, no, skip) is written here and shows on the Expenses / Bills pages under Done and Not done.
export type FinanceKind = 'expenses' | 'bills'

let ready: Promise<void> | null = null
export function ensureFinanceChecks(): Promise<void> {
  ready ??= (async () => {
    await sql`CREATE TABLE IF NOT EXISTS finance_checks (
      id SERIAL PRIMARY KEY, kind TEXT NOT NULL, day TEXT NOT NULL, who TEXT NOT NULL, answer TEXT NOT NULL, action TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`
  })().catch(e => { ready = null; throw e })
  return ready
}

// Which checks are due when the manager logs in: expenses always, bills on Tuesday (2) and Friday (5). The shop's time is UTC.
export function checksDue(d = new Date()): FinanceKind[] {
  const wd = d.getUTCDay()
  return wd === 2 || wd === 5 ? ['expenses', 'bills'] : ['expenses']
}

// The two laws behind the checks (written once; the owner can edit them on the Expenses and Bills pages).
export async function financeLawsOnce() {
  try {
    const laws: { seed: string; sub: string; title: string; text: string; v: { text: string; points: number; by: string; record: string; how: string }[] }[] = [
      {
        seed: 'financecheck-expenses-v1', sub: 'Expenses', title: 'Confirm every expense is recorded',
        text: 'Every time the manager logs in, the app asks whether all expenses have been recorded on the system. If yes, that is all. If no, the manager either records the outstanding expenses now (the app opens Expenses) or skips. Every answer, including a skip, is recorded on the Expenses page under Done or Not done, and the owner is told when the answer is not a yes.',
        v: [{ text: 'Skipped the expenses question while expenses were still not recorded', points: 1, by: 'manual', record: 'Logged by the owner when Not done on Expenses shows a skip', how: 'Open Expenses\nRecord every expense that is not yet on the system' }],
      },
      {
        seed: 'financecheck-bills-v1', sub: 'Bills', title: 'Confirm every bill is recorded',
        text: 'Every Tuesday and Friday, when the manager logs in, the app asks whether all bills have been recorded on the system. If yes, that is all. If no, the manager either records the outstanding bills now (the app opens Bills) or skips. Every answer, including a skip, is recorded on the Bills page under Done or Not done, and the owner is told when the answer is not a yes.',
        v: [{ text: 'Skipped the bills question while bills were still not recorded', points: 1, by: 'manual', record: 'Logged by the owner when Not done on Bills shows a skip', how: 'Open Bills\nRecord every bill that is not yet on the system' }],
      },
    ]
    for (const l of laws) {
      const [{ n }] = await sql`SELECT COUNT(*)::int AS n FROM page_laws WHERE seed = ${l.seed}`
      if (n) continue
      await sql`INSERT INTO page_laws (scope_key, text, display_in_carousel, carousel_type, category, subcategory, law_type, status, seed, points, violations, title, audience, live_at)
        VALUES ('Finance', ${l.text}, false, 'law', 'Finance', ${l.sub}, 'standing', 'live', ${l.seed}, 1, ${JSON.stringify(l.v)}, ${l.title}, 'managers', now())`
    }
  } catch (e) { console.error('finance laws failed:', e instanceof Error ? e.message : String(e)) }
}
