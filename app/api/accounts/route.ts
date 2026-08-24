import { requireAuth, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import { once } from '@/lib/once'
import { NextRequest } from 'next/server'

const ensureAccountsTable = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS accounts (
    id SERIAL PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  )`.catch(() => {})
})

export async function GET() {
  const { error } = await requireAuth()
  if (error) return error

  try {
    await ensureAccountsTable()

    const accounts = await sql`SELECT id, name FROM accounts ORDER BY name ASC`
    return success(accounts)
  } catch (e) {
    console.error('Failed to fetch accounts:', e)
    return success([])
  }
}

export async function POST(req: NextRequest) {
  const { error } = await requireAuth()
  if (error) return error

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return badRequest('Account name is required')
  }

  const trimmedName = name.trim()

  try {
    await ensureAccountsTable()

    const [account] = await sql`
      INSERT INTO accounts (name) VALUES (${trimmedName})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `
    return success(account)
  } catch (e) {
    return handleError('accounts POST', e)
  }
}
