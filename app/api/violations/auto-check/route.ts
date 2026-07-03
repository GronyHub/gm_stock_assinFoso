import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

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
      const rows = await sql`
        SELECT id, receipt_number, receipt_date::text AS receipt_date
        FROM sales_receipts
        WHERE LOWER(TRIM(customer_name)) = 'walk in customer'
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
    default:
      return { label: violationType, instances: [] }
  }
}

const AUTO_TYPES = ['missing_days', 'no_cash', 'cost_gte_sell', 'no_staff_times', 'unchecked_cab', 'dup_receipts']

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

    return NextResponse.json({ ok: true, created, summary })
  } catch (e) {
    console.error('violations auto-check error:', e)
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
