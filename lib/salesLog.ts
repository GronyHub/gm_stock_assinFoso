import sql from '@/lib/db'
import { negativeStockViolations } from '@/lib/stockGuard'
import { recordBuyer } from '@/lib/saleBuyers'

export type SaleLineInput = { itemId: number | null; name: string; qty: number; price: number }

// Customer receipts feed the Sales Log automatically, so the same work is never entered twice.
// Resolves each typed line to an item (picked id, else an exact name match on the active items;
// otherwise it stays unresolved for the alias system), and applies the same rules as a sale:
// no negative stock, and not at or below cost price. Returns an error message to block the save.
export async function resolveSaleLines(lines: { itemId?: number | null; item: string; qty: number; price: number }[]): Promise<{ lines: SaleLineInput[]; error?: string }> {
  const out: SaleLineInput[] = []
  for (const l of lines) {
    let itemId: number | null = null
    if (l.itemId) {
      const [it] = await sql`SELECT id FROM items WHERE id = ${Number(l.itemId)}`
      if (it) itemId = it.id as number
    }
    if (!itemId) {
      const [it] = await sql`SELECT id FROM active_items WHERE LOWER(canonical_name) = LOWER(${l.item}) LIMIT 1`
      if (it) itemId = it.id as number
    }
    out.push({ itemId, name: l.item, qty: l.qty, price: l.price })
  }
  const deltas = new Map<number, number>()
  for (const l of out) if (l.itemId) deltas.set(l.itemId, (deltas.get(l.itemId) ?? 0) + l.qty)
  if (deltas.size) {
    const violations = await negativeStockViolations(deltas)
    if (violations.length) return { lines: out, error: `Not allowed — this would create negative stock. ${violations.join(' ')}` }
    const ids = [...deltas.keys()]
    const costRows = await sql`SELECT id, COALESCE(adjusted_cost_price, purchase_rate, 0) AS cost_price, canonical_name FROM items WHERE id = ANY(${ids})` as { id: number; cost_price: string; canonical_name: string }[]
    for (const l of out) {
      const info = costRows.find(r => r.id === l.itemId)
      const cost = Number(info?.cost_price) || 0
      if (info && cost > 0 && l.price <= cost) return { lines: out, error: `Selling price (₵${l.price.toFixed(2)}) must be above cost price (₵${cost.toFixed(2)}) for ${info.canonical_name}.` }
    }
  }
  return { lines: out }
}

// Adds the lines to that date's walk-in sales receipt (creating it if the day has none yet),
// merging into an existing line for the same item, and remembers the buyer for the Sales Log.
export async function addCustomerReceiptToSales(opts: {
  date: string; lines: SaleLineInput[]; enteredBy: string | null; invoiceId: number
  customerCode: string | null; customerName: string | null; customerPhone: string | null
}): Promise<number> {
  const { date } = opts
  let [receipt] = await sql`SELECT id FROM sales_receipts WHERE receipt_date::date = ${date} AND customer_name IS DISTINCT FROM 'Grony Multimedia as Customer' ORDER BY id LIMIT 1`
  if (!receipt) {
    const num = `APP-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
    try {
      ;[receipt] = await sql`INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source, entered_by) VALUES (${num}, ${date}, NULL, 0, 'app', ${opts.enteredBy}) RETURNING id`
    } catch {
      ;[receipt] = await sql`INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source) VALUES (${num}, ${date}, NULL, 0, 'app') RETURNING id`
    }
  }
  for (const l of opts.lines) {
    const amount = l.qty * l.price
    let line
    if (l.itemId) {
      ;[line] = await sql`UPDATE sales_receipt_lines SET quantity = quantity::numeric + ${l.qty}, item_total = item_total::numeric + ${amount}
        WHERE receipt_id = ${receipt.id} AND item_id = ${l.itemId} RETURNING id`
    }
    if (!line) {
      await sql`INSERT INTO sales_receipt_lines (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
        VALUES (${receipt.id}, ${l.itemId}, ${l.name}, ${l.itemId ? l.name : null}, ${l.qty}, ${l.price}, ${amount}, ${!l.itemId}, 'customer_receipt')`
    }
    await recordBuyer({ receiptId: receipt.id as number, invoiceId: opts.invoiceId, itemId: l.itemId, itemName: l.name, qty: l.qty, price: l.price,
      customerIdCode: opts.customerCode, customerName: opts.customerName, customerPhone: opts.customerPhone, source: 'receipt', createdBy: opts.enteredBy })
  }
  await sql`UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id}) WHERE id = ${receipt.id}`
  try {
    const [existing] = await sql`SELECT 1 FROM cash_at_bank WHERE entry_date = ${date}`
    if (!existing) await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date})`
  } catch { /* non-fatal */ }
  return receipt.id as number
}
