import sql from '@/lib/db'
import bcrypt from 'bcryptjs'
import { ensurePasswordResetTokens } from '@/lib/passwordResetTokens'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const { token, password } = await req.json()
  if (!token || !password) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })
  if (password.length < 6) return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 })

  try {
    await ensurePasswordResetTokens()
    const [row] = await sql`
      SELECT prt.id, prt.user_id, prt.expires_at, prt.used
      FROM password_reset_tokens prt
      WHERE prt.token = ${token}
    `
    if (!row) return NextResponse.json({ error: 'Invalid or expired link' }, { status: 400 })
    if (row.used) return NextResponse.json({ error: 'This link has already been used' }, { status: 400 })
    if (new Date(row.expires_at) < new Date()) return NextResponse.json({ error: 'Link has expired' }, { status: 400 })

    const hash = await bcrypt.hash(password, 12)
    await sql`UPDATE app_users SET password_hash = ${hash} WHERE id = ${row.user_id}`
    await sql`UPDATE password_reset_tokens SET used = true WHERE id = ${row.id}`

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('reset-password error:', e)
    return NextResponse.json({ error: 'Failed to reset password' }, { status: 500 })
  }
}
