import sql from '@/lib/db'

// deficit was always written by the CAB confirm form's save route, but the
// physical column was never actually added to cash_at_bank -- only
// cash_at_bank_view computed it, so every confirmation attempt failed with
// "column deficit does not exist" until this ran once.
export async function ensureCashAtBankDeficitColumn() {
  await sql`ALTER TABLE cash_at_bank ADD COLUMN IF NOT EXISTS deficit NUMERIC`.catch(() => {})
}
