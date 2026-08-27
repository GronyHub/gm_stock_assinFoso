/**
 * Backfill missing pre-Zoho GMC (internal-use) history for the "4 x 6"
 * photopaper pack item, sourced from the "srv" sheet of
 * "(pre-zoho) M-LAWS_ENTRY & srv in Excal.xlsx", row 126.
 *
 * Row 126's 5 dated daily-breakdown cells sum to exactly its own recorded
 * lifetime total (295), so these 9 entries are the full, verified GMC-take
 * history that sheet records for this item (2023 columns are genuinely
 * zero -- there's nothing from 2023 to migrate):
 *   2024-10-09: 50   2024-11-27: 45   2024-12-13: 45   2025-01-31: 45
 *   2025-04-02: 22   2025-04-08: 22   2025-04-17: 22   2025-04-28: 22
 *   2025-05-06: 22
 *
 * Mirrors exactly how a live GMC tap is recorded today (see
 * /api/sales/live-tap/route.ts): one sales_receipts row per day for
 * customer_name = 'Grony Multimedia as Customer', one sales_receipt_lines
 * row per item on that receipt. Tagged source = 'prezoho_mlaws', same as
 * every other historical import from this workbook (see
 * scripts/import-gmc-prezoho.mjs, import-prezoho-expenses.mjs).
 *
 * Item lookup is alias-driven, never hardcoded and never creates a new
 * item (per explicit instruction) -- it searches items.canonical_name and
 * item_aliases.alias_name for the pack item and aborts with the candidate
 * list if the match isn't exactly one row.
 *
 * Idempotent: skips any date that already has a sales_receipt_lines row
 * for this item under the GMC customer, so it's safe to re-run.
 *
 * Run: node scripts/import-4x6-gmc-history.mjs
 */
import { readFileSync } from 'fs'
import { neon } from '@neondatabase/serverless'

const url = readFileSync('.env.local', 'utf8').split('\n').find(l => l.trim().startsWith('postgres')).trim()
const sql = neon(url)

const ENTRIES = [
  { date: '2024-10-09', qty: 50 },
  { date: '2024-11-27', qty: 45 },
  { date: '2024-12-13', qty: 45 },
  { date: '2025-01-31', qty: 45 },
  { date: '2025-04-02', qty: 22 },
  { date: '2025-04-08', qty: 22 },
  { date: '2025-04-17', qty: 22 },
  { date: '2025-04-28', qty: 22 },
  { date: '2025-05-06', qty: 22 },
]

const CUSTOMER_NAME = 'Grony Multimedia as Customer'
const SOURCE = 'prezoho_mlaws'

console.log('\n══════════════════════════════════════════════════')
console.log('  IMPORT 4x6 PACK GMC HISTORY (srv row 126)')
console.log('══════════════════════════════════════════════════\n')

// 1. Find the target item via aliases -- never guess, never create.
const candidates = await sql`
  SELECT DISTINCT i.id, i.canonical_name, i.product_type, i.status
  FROM items i
  LEFT JOIN item_aliases a ON a.item_id = i.id
  WHERE i.canonical_name ILIKE '%4%6%'
     OR i.canonical_name ILIKE '%4x6%'
     OR a.alias_name ILIKE '%4%x%6%'
     OR a.alias_name ILIKE '%4x6%'
`
const packCandidates = candidates.filter(c =>
  c.product_type !== 'service' &&
  /pack|box/i.test(c.canonical_name)
)

if (packCandidates.length !== 1) {
  console.error('✗ Could not uniquely resolve the "4 x 6" pack item. Candidates found:')
  for (const c of candidates) {
    console.error(`    id=${c.id}  "${c.canonical_name}"  (${c.product_type}, status=${c.status ?? 'active'})`)
  }
  console.error('\nRefine the WHERE/filter above to pick exactly one row, then re-run.')
  process.exit(1)
}
const item = packCandidates[0]
console.log(`✓ Target item: id=${item.id}  "${item.canonical_name}"\n`)

const cust = await sql`SELECT id FROM customers WHERE display_name ILIKE '%Grony Multimedia%' LIMIT 1`
const customerId = cust[0]?.id ?? null

let inserted = 0, skipped = 0

for (const { date, qty } of ENTRIES) {
  // Idempotency: skip if this item already has a line on this date under the GMC customer.
  const existing = await sql`
    SELECT srl.id
    FROM sales_receipt_lines srl
    JOIN sales_receipts sr ON sr.id = srl.receipt_id
    WHERE srl.item_id = ${item.id}
      AND sr.receipt_date::date = ${date}
      AND sr.customer_name = ${CUSTOMER_NAME}
  `
  if (existing.length > 0) {
    console.log(`  – ${date}: already recorded (line id=${existing[0].id}), skipping`)
    skipped++
    continue
  }

  let [receipt] = await sql`
    SELECT id FROM sales_receipts WHERE receipt_date::date = ${date} AND customer_name = ${CUSTOMER_NAME}
  `
  if (!receipt) {
    const receiptNumber = `GMC-PREZOHO-${date}`
    ;[receipt] = await sql`
      INSERT INTO sales_receipts (
        receipt_number, receipt_date, payment_mode, customer_name, customer_id,
        deposit_to, currency_code, subtotal, total, balance, adjustment, source
      ) VALUES (
        ${receiptNumber}, ${date}, 'Cash', ${CUSTOMER_NAME}, ${customerId},
        'Cash in hand', 'GHS', 0, 0, 0, 0, ${SOURCE}
      )
      ON CONFLICT (receipt_number) DO UPDATE SET receipt_date = EXCLUDED.receipt_date
      RETURNING id
    `
  }

  const [priceRow] = await sql`SELECT COALESCE(selling_rate, 0) AS rate FROM items WHERE id = ${item.id}`
  const price = Number(priceRow?.rate ?? 0)
  const lineTotal = price * qty

  await sql`
    INSERT INTO sales_receipt_lines (
      receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source
    ) VALUES (
      ${receipt.id}, ${item.id}, ${item.canonical_name}, ${item.canonical_name}, ${qty}, ${price}, ${lineTotal}, false, ${SOURCE}
    )
  `
  await sql`
    UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id}),
      subtotal = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id})
    WHERE id = ${receipt.id}
  `

  console.log(`  ✓ ${date}: +${qty} (receipt id=${receipt.id})`)
  inserted++
}

console.log('\n══════════════════════════════════════════════════')
console.log(`  Inserted : ${inserted}`)
console.log(`  Skipped  : ${skipped} (already present)`)
console.log('  ✅ Done!\n')
