import sql from '@/lib/db'
import { NextResponse } from 'next/server'

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Replicates the exact logic of POST /api/sales/live-tap (auth bypassed --
// this is a diagnostic route, not a real staff action)
async function doTap(itemId: number, quantity: number, staffName: string) {
  const qty = Math.max(1, Math.floor(Number(quantity) || 1))
  const date = todayStr()

  const [item] = await sql`SELECT id, canonical_name, selling_rate FROM items WHERE id = ${itemId}`
  if (!item) throw new Error('item not found')
  const price = Number(item.selling_rate) || 0
  const lineAmount = price * qty

  let [receipt] = await sql`
    SELECT id FROM sales_receipts
    WHERE receipt_date::date = ${date} AND customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
  `
  let createdReceipt = false
  if (!receipt) {
    createdReceipt = true
    const receiptNumber = `APP-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`
    ;[receipt] = await sql`
      INSERT INTO sales_receipts (receipt_number, receipt_date, customer_name, total, source, entered_by)
      VALUES (${receiptNumber}, ${date}, NULL, 0, 'live_sale', ${staffName})
      RETURNING id
    `
  }

  let [line] = await sql`
    UPDATE sales_receipt_lines
    SET quantity = quantity::numeric + ${qty}, item_total = item_total::numeric + ${lineAmount}
    WHERE receipt_id = ${receipt.id} AND item_id = ${item.id}
    RETURNING id, quantity, item_total
  `
  if (!line) {
    ;[line] = await sql`
      INSERT INTO sales_receipt_lines
        (receipt_id, item_id, raw_item_name, resolved_name, quantity, item_price, item_total, unresolved, source)
      VALUES (${receipt.id}, ${item.id}, ${item.canonical_name}, ${item.canonical_name}, ${qty}, ${price}, ${lineAmount}, false, 'live_sale')
      RETURNING id, quantity, item_total
    `
  }

  await sql`
    UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${receipt.id})
    WHERE id = ${receipt.id}
  `

  const [tap] = await sql`
    INSERT INTO live_sale_taps (item_id, item_name, price, staff_name, receipt_id, receipt_line_id, quantity)
    VALUES (${item.id}, ${item.canonical_name}, ${price}, ${staffName}, ${receipt.id}, ${line.id}, ${qty})
    RETURNING id, item_id, item_name, price, staff_name, tapped_at, undone, quantity
  `

  return { tap, line, receiptId: receipt.id, createdReceipt, price, qty, lineAmount }
}

// Replicates the exact logic of DELETE /api/sales/live-tap/[id]
async function doUndo(tapId: number) {
  const [tap] = await sql`SELECT * FROM live_sale_taps WHERE id = ${tapId}`
  if (!tap) throw new Error('tap not found')
  if (tap.undone) return { alreadyUndone: true }

  await sql`UPDATE live_sale_taps SET undone = true WHERE id = ${tap.id}`
  const qty = Number(tap.quantity) || 1
  const lineAmount = Number(tap.price) * qty

  let lineDeleted = false
  let lineAfter = null
  if (tap.receipt_line_id) {
    const [line] = await sql`
      UPDATE sales_receipt_lines
      SET quantity = quantity::numeric - ${qty}, item_total = item_total::numeric - ${lineAmount}
      WHERE id = ${tap.receipt_line_id}
      RETURNING id, quantity
    `
    lineAfter = line
    if (line && Number(line.quantity) <= 0) {
      await sql`DELETE FROM sales_receipt_lines WHERE id = ${line.id}`
      lineDeleted = true
    }
    if (tap.receipt_id) {
      await sql`
        UPDATE sales_receipts SET total = (SELECT COALESCE(SUM(item_total), 0) FROM sales_receipt_lines WHERE receipt_id = ${tap.receipt_id})
        WHERE id = ${tap.receipt_id}
      `
    }
  }
  return { qty, lineAmount, lineAfter, lineDeleted }
}

export async function POST() {
  const results: Record<string, unknown> = {}
  const STAFF = 'diagnostic-test'
  let serviceTap: Awaited<ReturnType<typeof doTap>> | undefined
  let goodsTap: Awaited<ReturnType<typeof doTap>> | undefined

  try {
    serviceTap = await doTap(331, 20, STAFF)
    results.serviceTapResult = serviceTap

    goodsTap = await doTap(5, 3, STAFF)
    results.goodsTapResult = goodsTap

    const [receiptWithBoth] = await sql`SELECT id, receipt_number, total FROM sales_receipts WHERE id = ${serviceTap.receiptId}`
    const linesWithBoth = await sql`SELECT id, item_id, quantity, item_total FROM sales_receipt_lines WHERE receipt_id = ${serviceTap.receiptId} ORDER BY id`
    results.receiptAfterBothTaps = { receipt: receiptWithBoth, lines: linesWithBoth }

    const undoService = await doUndo(serviceTap.tap.id)
    const undoGoods = await doUndo(goodsTap.tap.id)
    results.undoServiceResult = undoService
    results.undoGoodsResult = undoGoods

    const [receiptAfter] = await sql`SELECT id, receipt_number, total FROM sales_receipts WHERE id = ${serviceTap.receiptId}`
    const linesAfter = await sql`SELECT id FROM sales_receipt_lines WHERE receipt_id = ${serviceTap.receiptId}`
    results.receiptAfterUndos = { receipt: receiptAfter, remainingLines: linesAfter }

    let receiptCleanedUp = false
    if (serviceTap.createdReceipt && linesAfter.length === 0) {
      await sql`DELETE FROM sales_receipts WHERE id = ${serviceTap.receiptId}`
      receiptCleanedUp = true
    }
    await sql`DELETE FROM live_sale_taps WHERE id = ANY(${[serviceTap.tap.id, goodsTap.tap.id]})`
    results.cleanup = { receiptCleanedUp, tapsDeleted: [serviceTap.tap.id, goodsTap.tap.id] }
  } catch (e) {
    results.error = e instanceof Error ? e.message : String(e)
    results.stack = e instanceof Error ? e.stack : undefined
    results.partialState = { serviceTap, goodsTap }
  }

  return NextResponse.json(results)
}

export async function GET() {
  // Recovery/inspection helper -- see what's actually sitting in the DB
  // right now if the POST test errored partway through.
  const taps = await sql`SELECT * FROM live_sale_taps WHERE staff_name = 'diagnostic-test'`
  const receipts = await sql`
    SELECT id, receipt_number, total FROM sales_receipts
    WHERE receipt_date::date = ${todayStr()} AND customer_name IS DISTINCT FROM 'Grony Multimedia as Customer'
  `
  const lines = receipts.length
    ? await sql`SELECT * FROM sales_receipt_lines WHERE receipt_id = ANY(${receipts.map((r: any) => r.id)})`
    : []
  return NextResponse.json({ diagnosticTaps: taps, todaysReceipts: receipts, todaysLines: lines })
}
