import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { isOwnerLevel } from '@/lib/roles'
import { quizOfDay } from '@/lib/serviceQuiz'
import { NextRequest } from 'next/server'

const ensureTable = once(async () => {
  await sql`
    CREATE TABLE IF NOT EXISTS customer_service_daily (
      username TEXT NOT NULL,
      day DATE NOT NULL,
      tag_worn BOOLEAN NOT NULL DEFAULT FALSE,
      quiz_id INTEGER,
      answer INTEGER,
      correct BOOLEAN,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (username, day)
    )
  `.catch(() => {})
})

const nameOf = (u: any) => String(u?.username ?? u?.name ?? '').toLowerCase()
const today = () => new Date().toISOString().slice(0, 10) // Ghana is GMT year-round

// GET: has the signed-in person done today's card? Owner-level also gets everyone's status and a monthly score.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureTable()
    const me = nameOf(user); const day = today()
    const [role] = await sql`SELECT role FROM app_users WHERE LOWER(username) = ${me}`
    if (role?.role === 'children_manager') return success({ skip: true })
    const [mine] = await sql`SELECT tag_worn, quiz_id, answer, correct FROM customer_service_daily WHERE username = ${me} AND day = ${day}`
    const out: Record<string, unknown> = { day, done: !!mine, mine: mine ?? null }
    if (isOwnerLevel(user as any)) {
      out.team = await sql`
        SELECT LOWER(u.username) AS username, u.display_name,
               d.tag_worn, d.correct,
               (SELECT COUNT(*) FROM customer_service_daily x WHERE x.username = LOWER(u.username) AND x.correct AND x.day >= ${day}::date - 29)::int AS correct_30d,
               (SELECT COUNT(*) FROM customer_service_daily x WHERE x.username = LOWER(u.username) AND x.day >= ${day}::date - 29)::int AS days_30d
        FROM app_users u LEFT JOIN customer_service_daily d ON d.username = LOWER(u.username) AND d.day = ${day}
        WHERE u.active IS NOT FALSE AND u.role <> 'children_manager' ORDER BY u.id
      `
    }
    return success(out)
  } catch (e) { return handleError('customer-service daily GET', e) }
}

// POST { tagWorn, answer } -- records today's tag tick and quiz answer (once per day; the first answer counts).
export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    await ensureTable()
    const { tagWorn, answer } = await req.json()
    if (typeof answer !== 'number') return badRequest('Pick an answer.')
    const me = nameOf(user); const day = today(); const q = quizOfDay(day)
    const correct = answer === q.answer
    await sql`
      INSERT INTO customer_service_daily (username, day, tag_worn, quiz_id, answer, correct)
      VALUES (${me}, ${day}, ${!!tagWorn}, ${q.id}, ${answer}, ${correct})
      ON CONFLICT (username, day) DO NOTHING
    `
    return success({ correct, right: q.answer, why: q.why })
  } catch (e) { return handleError('customer-service daily POST', e) }
}
