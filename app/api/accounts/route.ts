import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json([], { status: 401 })

  try {
    await sql`CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`.catch(() => {})

    const accounts = await sql`SELECT id, name FROM accounts ORDER BY name ASC`
    return NextResponse.json(accounts)
  } catch (e) {
    console.error('Failed to fetch accounts:', e)
    return NextResponse.json([], { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { name } = await req.json()
  if (!name || typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'Account name is required' }, { status: 400 })
  }

  const trimmedName = name.trim()

  try {
    await sql`CREATE TABLE IF NOT EXISTS accounts (
      id SERIAL PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW()
    )`.catch(() => {})

    const [account] = await sql`
      INSERT INTO accounts (name) VALUES (${trimmedName})
      ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
      RETURNING id, name
    `
    return NextResponse.json(account)
  } catch (e) {
    console.error('Failed to create account:', e)
    const message = e instanceof Error ? e.message : String(e)
    if (message.includes('duplicate key')) {
      return NextResponse.json({ error: 'Account already exists' }, { status: 409 })
    }
    return NextResponse.json({ error: `Failed to create account: ${message}` }, { status: 500 })
  }
}
