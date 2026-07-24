import sql from '@/lib/db'

// The old property_status column (at_shop/not_at_shop/spoilt) is still read
// by the standalone /expenses page's own editor -- left in place, untouched.
// These columns hold the richer Available/Not Available -> Working/Location
// or Reason cascade used by the Expenses tab's edit panel instead.
export async function ensureExpensePropertyColumns() {
  await sql`ALTER TABLE expense_properties ADD COLUMN IF NOT EXISTS availability TEXT`.catch(() => {})
  await sql`ALTER TABLE expense_properties ADD COLUMN IF NOT EXISTS working TEXT`.catch(() => {})
  await sql`ALTER TABLE expense_properties ADD COLUMN IF NOT EXISTS location TEXT`.catch(() => {})
  await sql`ALTER TABLE expense_properties ADD COLUMN IF NOT EXISTS not_working_reason TEXT`.catch(() => {})
  await sql`ALTER TABLE expense_properties ADD COLUMN IF NOT EXISTS not_available_reason TEXT`.catch(() => {})
}
