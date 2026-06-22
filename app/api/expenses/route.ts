import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { date, description, account, amount } = await req.json()
  if (!date || !description || !amount) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const entryNumber = `APP-EXP-${date.replace(/-/g,'')}-${Date.now().toString().slice(-4)}`
  await sql`
    INSERT INTO expenses (entry_number, expense_date, description, expense_account, amount, total, source)
    VALUES (${entryNumber}, ${date}, ${description}, ${account}, ${amount}, ${amount}, 'app')
  `
  await sql`INSERT INTO cash_at_bank (entry_date) VALUES (${date}) ON CONFLICT (entry_date) DO NOTHING`
  return NextResponse.json({ ok: true })
}
