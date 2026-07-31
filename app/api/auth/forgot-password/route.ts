import sql from '@/lib/db'
import { sendPasswordResetEmail } from '@/lib/mailer'
import { ensurePasswordResetTokens } from '@/lib/passwordResetTokens'
import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email required' }, { status: 400 })

  try {
    await ensurePasswordResetTokens()
    const [user] = await sql`SELECT id, display_name, email FROM app_users WHERE email = ${email}`
    // Always return success to avoid email enumeration
    if (!user) return NextResponse.json({ ok: true })

    const token = crypto.randomBytes(32).toString('hex')
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

    await sql`
      INSERT INTO password_reset_tokens (user_id, token, expires_at)
      VALUES (${user.id}, ${token}, ${expiresAt.toISOString()})
    `

    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000'
    const resetUrl = `${baseUrl}/reset-password?token=${token}`

    await sendPasswordResetEmail(user.email, user.display_name, resetUrl)

    return NextResponse.json({ ok: true })
  } catch (e) {
    // Surface the real cause in Vercel's function logs -- the client only
    // ever sees a generic "Something went wrong", so without this a failed
    // send (bad GMAIL_APP_PASSWORD, missing table, etc.) is undiagnosable.
    console.error('forgot-password error:', e)
    return NextResponse.json({ error: 'Failed to send reset email' }, { status: 500 })
  }
}
