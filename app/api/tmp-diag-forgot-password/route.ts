import sql from '@/lib/db'
import { NextResponse } from 'next/server'

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
