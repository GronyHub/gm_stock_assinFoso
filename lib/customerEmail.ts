import sql from '@/lib/db'
import { sendTransactionEmail } from '@/lib/mailer'
import { customerLifetimeTotal, PRIZE_TARGET } from '@/lib/customerProfile'

// Emails the work done / total / contact details to a saved customer who has an
// email on file. Best effort: never throws, so a mail problem can't block a sale.
export async function emailWorkDone(code: string | null | undefined, items: { name: string; qty: number; price: number }[], receiptNo?: string) {
  if (!code || !items.length) return
  try {
    const [c] = await sql`SELECT first_name, display_name, email FROM customers WHERE customer_id_code = ${code}`
    if (!c?.email) return
    await sendTransactionEmail(c.email as string, (c.first_name || c.display_name) as string, code, items,
      { receiptNo, lifetime: await customerLifetimeTotal(code), prizeTarget: PRIZE_TARGET })
  } catch (e) { console.error('emailWorkDone:', e instanceof Error ? e.message : String(e)) }
}
