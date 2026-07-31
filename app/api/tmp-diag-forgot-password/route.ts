import sql from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/mailer'
import { NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST() {
  try {
    const [user] = await sql`SELECT id, display_name, email FROM app_users WHERE email = 'fiifi4x@gmail.com'`
    if (!user) return NextResponse.json({ error: 'no matching user' })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000)

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})
    `

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(user.email, user.display_name, resetUrl)

    return NextResponse.json({ ok: true })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e), stack: e instanceof Error ? e.stack : undefined },
      { status: 500 },
    )
  }
}

export async function GET() {
  const out: Record<string, unknown> = {}

  try {
    const rows = await sql`SELECT to_regclass('public.password_reset_tokens') AS exists`
    out.password_reset_tokens_table = rows[0]?.exists ?? null
  } catch (e) {
    out.password_reset_tokens_table_error = e instanceof Error ? e.message : String(e)
  }

  try {
    const rows = await sql`SELECT id, username, email FROM app_users WHERE email = 'fiifi4x@gmail.com'`
    out.matching_user = rows
  } catch (e) {
    out.matching_user_error = e instanceof Error ? e.message : String(e)
  }

  out.gmail_app_password_set = !!process.env.GMAIL_APP_PASSWORD
  out.nextauth_url = process.env.NEXTAUTH_URL ?? null

  return NextResponse.json(out)
}
