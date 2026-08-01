import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { requiredDailyItemIds } from '@/lib/countRules'
import { openerOf } from '@/lib/staffTimes'
import { NextRequest, NextResponse } from 'next/server'

// Shown as-is in Grony Manage's Opener view's Penalty Points section (see
// OpenerView.tsx) -- must match the literal string used there.
const OPENER_VIOLATION_TYPE = 'opener_daily_count'
const OPENER_VIOLATION_LABEL = 'Missed daily opener counts'

// Dress code -- self-attributed to the named staff member directly, not a
// fixed assignee, so it gets its own pass below (same reasoning as Opener
// accountability). shirt_not_worn accumulates over a rolling window instead
// of a single "since when" date, since a past day's lapse doesn't go stale
// the way an unresolved data gap does -- reasoned defaults, easy to retune.
const SHIRT_NOT_WORN_TYPE = 'shirt_not_worn'
const SHIRT_OVERDUE_TYPE = 'shirt_overdue'
const SHIRT_WINDOW_DAYS = 30
const SHIRT_THRESHOLD = 3

function daysSince(dateStr: string): number {
  const d = new Date(dateStr + 'T00:00:00')
  const today = new Date(); today.setHours(0, 0, 0, 0)
  return Math.round((today.getTime() - d.getTime()) / 86400000)
}

type Instance = { key: string; date: string; details: string }

async function getInstances(violationType: string): Promise<{ label: string; instances: Instance[] }> {
  switch (violationType) {
    case 'missing_days': {
      const rows = await sql`
        WITH date_series AS (
          SELECT generate_series(
            (SELECT MIN(receipt_date) FROM sales_receipts),
            CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day'
          )::date AS d
        )
        SELECT d::text AS missing_date FROM date_series
        WHERE EXTRACT(DOW FROM d) <> 0
          AND d NOT IN (SELECT DISTINCT receipt_date::date FROM sales_receipts)
          AND d NOT IN (SELECT work_date FROM no_work_days)
        ORDER BY d DESC
      `
      return { label: 'Sales Receipt not entered', instances: rows.map((r: any) => ({ key: r.missing_date, date: r.missing_date, details: `Date: ${r.missing_date}` })) }
    }
    case 'no_cash': {
      // Walk-in receipts created through the app store customer_name as NULL --
      // older/imported rows may still have the literal string.
      const rows = await sql`
        SELECT id, receipt_number, receipt_date::text AS receipt_date
        FROM sales_receipts
        WHERE (customer_name IS NULL OR LOWER(TRIM(customer_name)) = 'walk in customer')
          AND (cash_counted IS NULL OR cash_counted = 0)
      `
      return { label: 'Walk-in receipt missing cash counted', instances: rows.map((r: any) => ({ key: String(r.id), date: r.receipt_date, details: `Receipt ${r.receipt_number}` })) }
    }
    case 'cost_gte_sell': {
      const rows = await sql`
        SELECT sr.id AS receipt_id, sr.receipt_number, sr.receipt_date::text AS receipt_date, i.id AS item_id,
          COALESCE(srl.resolved_name, srl.raw_item_name) AS item_name
        FROM sales_receipt_lines srl
        JOIN sales_receipts sr ON sr.id = srl.receipt_id
        JOIN items i ON i.id = srl.item_id
        WHERE i.purchase_rate IS NOT NULL AND srl.item_price IS NOT NULL
          AND i.purchase_rate >= srl.item_price AND srl.item_price > 0
      `
      return { label: 'Cost Price \u2265 Selling Price unresolved', instances: rows.map((r: any) => ({ key: `${r.receipt_id}-${r.item_id}`, date: r.receipt_date, details: `${r.item_name} on receipt ${r.receipt_number}` })) }
    }
    case 'no_staff_times': {
      const rows = await sql`
        WITH date_series AS (
          SELECT generate_series(
            (SELECT MIN(work_date) FROM staff_times),
            CURRENT_DATE - INTERVAL '1 day', INTERVAL '1 day'
          )::date AS d
        )
        SELECT d::text AS missing_date FROM date_series
        WHERE EXTRACT(DOW FROM d) <> 0
          AND d NOT IN (SELECT DISTINCT work_date FROM staff_times WHERE actual_in IS NOT NULL)
        ORDER BY d DESC
      `
      return { label: 'No staff times recorded', instances: rows.map((r: any) => ({ key: r.missing_date, date: r.missing_date, details: `Date: ${r.missing_date}` })) }
    }
    case 'unchecked_cab': {
      const rows = await sql`
        WITH week_series AS (
          SELECT DATE_TRUNC('week', generate_series(
            DATE_TRUNC('week', (SELECT MIN(entry_date) FROM cash_at_bank)),
            DATE_TRUNC('week', CURRENT_DATE) - INTERVAL '7 days', INTERVAL '1 week'
          ))::date AS week_start
        )
        SELECT w.week_start::text, (w.week_start + INTERVAL '6 days')::date::text AS week_end
        FROM week_series w
        WHERE NOT EXISTS (
          SELECT 1 FROM cash_at_bank cab
          WHERE cab.entry_date >= w.week_start AND cab.entry_date <= w.week_start + INTERVAL '6 days'
            AND cab.cab_total IS NOT NULL
        )
      `
      return { label: 'No Cash at Bank confirmation', instances: rows.map((r: any) => ({ key: r.week_start, date: r.week_start, details: `Week of ${r.week_start} \u2013 ${r.week_end}` })) }
    }
    case 'dup_receipts': {
      const rows = await sql`
        SELECT
          receipt_date::text AS receipt_date,
          CASE WHEN customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END AS customer_type,
          COUNT(*) AS receipt_count,
          STRING_AGG(receipt_number, ', ' ORDER BY receipt_number) AS receipt_numbers
        FROM sales_receipts
        GROUP BY receipt_date::date, CASE WHEN customer_name = 'Grony Multimedia as Customer' THEN 'GMC' ELSE 'WIC' END
        HAVING COUNT(*) > 1
      `
      return { label: 'Duplicate WIC/GMC receipts', instances: rows.map((r: any) => ({ key: `${r.receipt_date}-${r.customer_type}`, date: r.receipt_date, details: `${r.customer_type} on ${r.receipt_date}: ${r.receipt_count} receipts (${r.receipt_numbers})` })) }
    }
    // These three have no natural "since when" date the way the others do
    // (a missing group or a duplicate pair isn't stamped with a date it
    // first appeared) -- `date` is left blank, which only matters for the
    // rolling threshold_days fallback below; with no deadline set, that
    // comparison never fires for these, so they're only ever auto-
    // penalized once someone sets an explicit deadline on the assignment.
    case 'no_group': {
      const rows = await sql`
        SELECT id, canonical_name AS item_name
        FROM items
        WHERE (cf_group IS NULL OR TRIM(cf_group) = '') AND LOWER(status) = 'active'
      `
      return { label: 'Item with no group assigned', instances: rows.map((r: any) => ({ key: String(r.id), date: '', details: r.item_name })) }
    }
    case 'duplicates': {
      let rows: any[]
      try {
        rows = await sql`
          SELECT a.id AS id1, a.canonical_name AS name1, b.id AS id2, b.canonical_name AS name2
          FROM items a
          JOIN items b ON a.id < b.id
            AND (LOWER(TRIM(a.canonical_name)) = LOWER(TRIM(b.canonical_name)) OR SIMILARITY(LOWER(a.canonical_name), LOWER(b.canonical_name)) > 0.65)
          WHERE LOWER(a.status) = 'active' AND LOWER(b.status) = 'active'
            AND NOT EXISTS (SELECT 1 FROM dismissed_duplicates dd WHERE dd.item_id1 = LEAST(a.id, b.id) AND dd.item_id2 = GREATEST(a.id, b.id))
        `
      } catch {
        rows = await sql`
          SELECT a.id AS id1, a.canonical_name AS name1, b.id AS id2, b.canonical_name AS name2
          FROM items a
          JOIN items b ON a.id < b.id AND LOWER(TRIM(a.canonical_name)) = LOWER(TRIM(b.canonical_name))
          WHERE LOWER(a.status) = 'active' AND LOWER(b.status) = 'active'
            AND NOT EXISTS (SELECT 1 FROM dismissed_duplicates dd WHERE dd.item_id1 = LEAST(a.id, b.id) AND dd.item_id2 = GREATEST(a.id, b.id))
        `
      }
      return { label: 'Possible duplicate item pair', instances: rows.map((r: any) => ({ key: `${r.id1}-${r.id2}`, date: '', details: `${r.name1} / ${r.name2}` })) }
    }
    case 'not_in_inventory': {
      const rows = await sql`
        SELECT item_name, source FROM (
          SELECT DISTINCT COALESCE(resolved_name, raw_item_name) AS item_name, 'Sales Receipt' AS source
          FROM sales_receipt_lines
          WHERE NOT EXISTS (SELECT 1 FROM items i WHERE LOWER(i.canonical_name) = LOWER(COALESCE(resolved_name, raw_item_name)))
          UNION
          SELECT DISTINCT item_name, 'Stock Count' AS source
          FROM stock_counts sc
          WHERE NOT EXISTS (SELECT 1 FROM items i WHERE LOWER(i.canonical_name) = LOWER(sc.item_name))
        ) t
      `
      return { label: 'Item name not found in inventory', instances: rows.map((r: any) => ({ key: `${r.item_name}|${r.source}`, date: '', details: `${r.item_name} (${r.source})` })) }
    }
    default:
      return { label: violationType, instances: [] }
  }
}

const AUTO_TYPES = [
  'missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab', 'dup_receipts',
  'no_group', 'duplicates', 'not_in_inventory',
]

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const [settingsRows, assignmentRows] = await Promise.all([
      sql`SELECT key, value FROM violation_settings`,
      sql`SELECT violation_type, staff_name, deadline FROM violation_assignments`,
    ])
    const settings: Record<string, string> = {}
    for (const r of settingsRows) settings[r.key] = r.value
    const assignments: Record<string, string> = {}
    const deadlines: Record<string, string> = {}
    for (const r of assignmentRows) {
      assignments[r.violation_type] = r.staff_name
      if (r.deadline) deadlines[r.violation_type] = String(r.deadline).slice(0, 10)
    }

    const thresholdDays = parseInt(settings.threshold_days ?? '3', 10)
    const points = parseInt(settings.points_per_violation ?? '5', 10)

    let created = 0
    const summary: string[] = []

    for (const type of AUTO_TYPES) {
      const assignedStaff = assignments[type]
      if (!assignedStaff) continue

      // A per-assignment deadline (once set) replaces the rolling threshold_days
      // check: the assignment is only overdue the day after that fixed date passes.
      const deadline = deadlines[type]

      const { label, instances } = await getInstances(type)
      for (const inst of instances) {
        const overdue = deadline ? daysSince(deadline) >= 1 : daysSince(inst.date) >= thresholdDays
        if (!overdue) continue

        const [already] = await sql`
          SELECT 1 FROM auto_penalty_log WHERE violation_type = ${type} AND instance_key = ${inst.key}
        `
        if (already) continue

        await sql`
          INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
          VALUES (${assignedStaff}, ${label}, ${inst.details}, 'major', ${points}, 'system-auto')
        `
        await sql`
          INSERT INTO auto_penalty_log (violation_type, instance_key, staff_name)
          VALUES (${type}, ${inst.key}, ${assignedStaff})
        `
        await logActivity('system-auto', 'auto-penalized', `${assignedStaff} \u2014 ${label} (${inst.details})`)
        created++
        summary.push(`${assignedStaff}: ${label} (${inst.details})`)
      }
    }

    // Opener accountability: for each of the last 30 shop-open days, whoever
    // was Opener (earliest clock-in) should have completed every required
    // daily count. Unlike AUTO_TYPES above, the "assignee" here is whoever
    // that day's actual Opener was, not a fixed configured staff member, so
    // it can't reuse that loop's shape -- handled as its own pass instead.
    try {
      const requiredItems = await requiredDailyItemIds()
      const requiredIds = requiredItems.map(r => r.id)

      if (requiredIds.length > 0) {
        const [staffRows, countRows, noWorkRows] = await Promise.all([
          sql`
            SELECT staff_name, work_date::text AS work_date, actual_in
            FROM staff_times
            WHERE work_date >= CURRENT_DATE - INTERVAL '30 days' AND work_date < CURRENT_DATE
              AND actual_in IS NOT NULL
            ORDER BY work_date, staff_name
          `,
          sql`
            SELECT DISTINCT item_id, count_date::date::text AS date
            FROM stock_counts
            WHERE item_id = ANY(${requiredIds})
              AND count_date >= CURRENT_DATE - INTERVAL '30 days' AND count_date < CURRENT_DATE
          `,
          sql`
            SELECT work_date::text AS work_date FROM no_work_days
            WHERE work_date >= CURRENT_DATE - INTERVAL '30 days' AND work_date < CURRENT_DATE
          `,
        ])

        const staffByDate = new Map<string, { staff_name: string; actual_in: string }[]>()
        for (const r of staffRows as { staff_name: string; work_date: string; actual_in: string }[]) {
          if (!staffByDate.has(r.work_date)) staffByDate.set(r.work_date, [])
          staffByDate.get(r.work_date)!.push(r)
        }
        const countedByDate = new Map<string, Set<number>>()
        for (const r of countRows as { item_id: number; date: string }[]) {
          if (!countedByDate.has(r.date)) countedByDate.set(r.date, new Set())
          countedByDate.get(r.date)!.add(r.item_id)
        }
        const noWorkDates = new Set((noWorkRows as { work_date: string }[]).map(r => r.work_date))

        for (const [date, staffToday] of staffByDate) {
          if (noWorkDates.has(date)) continue
          if (new Date(date + 'T00:00:00').getDay() === 0) continue // Sunday -- shop closed

          const opener = openerOf(staffToday)
          if (!opener) continue

          const countedN = countedByDate.get(date)?.size ?? 0
          if (countedN >= requiredIds.length) continue

          const [already] = await sql`
            SELECT 1 FROM auto_penalty_log WHERE violation_type = ${OPENER_VIOLATION_TYPE} AND instance_key = ${date}
          `
          if (already) continue

          const details = countedN === 0
            ? `${date}: did not perform any count at all`
            : `${date}: counted only ${countedN}/${requiredIds.length} counts`

          await sql`
            INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
            VALUES (${opener}, ${OPENER_VIOLATION_LABEL}, ${details}, 'major', ${points}, 'system-auto')
          `
          await sql`
            INSERT INTO auto_penalty_log (violation_type, instance_key, staff_name)
            VALUES (${OPENER_VIOLATION_TYPE}, ${date}, ${opener})
          `
          await logActivity('system-auto', 'auto-penalized', `${opener} — ${OPENER_VIOLATION_LABEL} (${details})`)
          created++
          summary.push(`${opener}: ${OPENER_VIOLATION_LABEL} (${details})`)
        }
      }
    } catch (e) {
      console.error('opener penalty check failed:', e)
    }

    // Dress code accountability: t-shirt owners the Closer logged as not
    // wearing it, and staff still without one past their given due date.
    try {
      await sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS has_company_tshirt BOOLEAN NOT NULL DEFAULT FALSE`.catch(() => {})
      await sql`ALTER TABLE staff_profiles ADD COLUMN IF NOT EXISTS tshirt_due_date DATE`.catch(() => {})

      const [closingRows, profileRows] = await Promise.all([
        sql`
          SELECT work_date::text AS work_date, no_tshirt_staff
          FROM closing_reports
          WHERE no_tshirt_staff IS NOT NULL AND TRIM(no_tshirt_staff) <> ''
          ORDER BY work_date
        `,
        sql`SELECT staff_name, has_company_tshirt, tshirt_due_date::text AS tshirt_due_date FROM staff_profiles`,
      ])

      const tshirtOwners = new Set(
        (profileRows as any[]).filter(p => p.has_company_tshirt).map(p => p.staff_name.toLowerCase())
      )
      const occurrencesByStaff = new Map<string, string[]>()
      for (const r of closingRows as { work_date: string; no_tshirt_staff: string }[]) {
        const names = (r.no_tshirt_staff || '').split(',').map(s => s.trim()).filter(Boolean)
        for (const name of names) {
          if (!tshirtOwners.has(name.toLowerCase())) continue
          if (!occurrencesByStaff.has(name)) occurrencesByStaff.set(name, [])
          occurrencesByStaff.get(name)!.push(r.work_date)
        }
      }

      for (const [staffName, dates] of occurrencesByStaff) {
        const sorted = [...dates].sort()
        for (const date of sorted) {
          const windowStart = new Date(date + 'T00:00:00')
          windowStart.setDate(windowStart.getDate() - (SHIRT_WINDOW_DAYS - 1))
          const windowStartStr = windowStart.toISOString().slice(0, 10)
          const countInWindow = sorted.filter(d => d >= windowStartStr && d <= date).length
          if (countInWindow < SHIRT_THRESHOLD) continue

          const instanceKey = `${staffName}|${date}`
          const [already] = await sql`
            SELECT 1 FROM auto_penalty_log WHERE violation_type = ${SHIRT_NOT_WORN_TYPE} AND instance_key = ${instanceKey}
          `
          if (already) continue

          const details = `${date}: did not wear company t-shirt (${countInWindow} lapses in the last ${SHIRT_WINDOW_DAYS} days)`
          await sql`
            INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
            VALUES (${staffName}, 'Dress code — t-shirt not worn', ${details}, 'major', ${points}, 'system-auto')
          `
          await sql`
            INSERT INTO auto_penalty_log (violation_type, instance_key, staff_name)
            VALUES (${SHIRT_NOT_WORN_TYPE}, ${instanceKey}, ${staffName})
          `
          await logActivity('system-auto', 'auto-penalized', `${staffName} — Dress code (${details})`)
          created++
          summary.push(`${staffName}: Dress code — t-shirt not worn (${details})`)
        }
      }

      const todayStr = new Date().toISOString().slice(0, 10)
      for (const p of profileRows as { staff_name: string; has_company_tshirt: boolean; tshirt_due_date: string | null }[]) {
        if (p.has_company_tshirt || !p.tshirt_due_date || p.tshirt_due_date >= todayStr) continue

        const instanceKey = `${p.staff_name}|${p.tshirt_due_date}`
        const [already] = await sql`
          SELECT 1 FROM auto_penalty_log WHERE violation_type = ${SHIRT_OVERDUE_TYPE} AND instance_key = ${instanceKey}
        `
        if (already) continue

        const details = `T-shirt still not given, was due ${p.tshirt_due_date}`
        await sql`
          INSERT INTO staff_violations (staff_name, violation, details, severity, points, recorded_by)
          VALUES (${p.staff_name}, 'Dress code — t-shirt overdue', ${details}, 'major', ${points}, 'system-auto')
        `
        await sql`
          INSERT INTO auto_penalty_log (violation_type, instance_key, staff_name)
          VALUES (${SHIRT_OVERDUE_TYPE}, ${instanceKey}, ${p.staff_name})
        `
        await logActivity('system-auto', 'auto-penalized', `${p.staff_name} — Dress code overdue (${details})`)
        created++
        summary.push(`${p.staff_name}: Dress code — t-shirt overdue (${details})`)
      }
    } catch (e) {
      console.error('dress code penalty check failed:', e)
    }

    return NextResponse.json({ ok: true, created, summary })
  } catch (e) {
    console.error('violations auto-check error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
