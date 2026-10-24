import sql from '@/lib/db'
import { once } from '@/lib/once'
import { normalizeGhPhone } from '@/lib/customerProfile'

// A customer's main number stays in customers.phone (everything already built reads it). Any extra
// numbers live here, so the GM box, search and messages can match or use any of them.
export const ensureCustomerPhones = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS customer_phones (
    id SERIAL PRIMARY KEY, customer_id INTEGER NOT NULL, phone TEXT NOT NULL, label TEXT,
    added_by TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE (customer_id, phone))`.catch(() => {})
  await sql`CREATE INDEX IF NOT EXISTS customer_phones_phone ON customer_phones (phone)`.catch(() => {})
})

export type PhoneRow = { id: number; phone: string; label: string | null }

// Who already has this number (as main or extra)? Optionally ignoring one customer.
export async function phoneOwner(rawPhone: unknown, exceptCustomerId?: number): Promise<{ id: number; display_name: string } | null> {
  const phone = normalizeGhPhone(rawPhone)
  if (!phone) return null
  await ensureCustomerPhones()
  const last9 = phone.slice(-9)
  const [row] = await sql`
    SELECT c.id, c.display_name FROM customers c
    WHERE c.id <> ${exceptCustomerId ?? 0} AND (
      RIGHT(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9) = ${last9}
      OR EXISTS (SELECT 1 FROM customer_phones p WHERE p.customer_id = c.id AND RIGHT(regexp_replace(p.phone, '\D', '', 'g'), 9) = ${last9}))
    LIMIT 1`
  return row ? { id: row.id as number, display_name: row.display_name as string } : null
}

export async function extraPhones(customerId: number): Promise<PhoneRow[]> {
  await ensureCustomerPhones()
  return await sql`SELECT id, phone, label FROM customer_phones WHERE customer_id = ${customerId} ORDER BY id` as PhoneRow[]
}

// A saved customer (with a GM number) whose main OR extra number is this one.
export async function findCustomerByPhone(rawPhone: unknown): Promise<{ id: number; customer_id_code: string; display_name: string; first_name: string | null; phone: string | null } | null> {
  const phone = normalizeGhPhone(rawPhone)
  if (!phone) return null
  await ensureCustomerPhones()
  const last9 = phone.slice(-9)
  const [row] = await sql`
    SELECT c.id, c.customer_id_code, c.display_name, c.first_name, c.phone FROM customers c
    WHERE c.customer_id_code IS NOT NULL AND (
      RIGHT(regexp_replace(COALESCE(c.phone, ''), '\D', '', 'g'), 9) = ${last9}
      OR EXISTS (SELECT 1 FROM customer_phones p WHERE p.customer_id = c.id AND RIGHT(regexp_replace(p.phone, '\D', '', 'g'), 9) = ${last9}))
    ORDER BY c.id LIMIT 1`
  return (row as never) ?? null
}
