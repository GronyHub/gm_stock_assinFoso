import sql from '@/lib/db'
import { NextResponse } from 'next/server'

export async function GET() {
  const patterns = ['%HDMI%30M%', '%WHITE%DL%', '%55A%', '%A4%120%', '%BESTPRINT%250%', '%Dell%Mouse%', '%A4%sheet%blue%', '%HDMI%MINI%', '%26A%']
  const results: Record<string, unknown> = {}
  for (const p of patterns) {
    results[p] = await sql`SELECT id, canonical_name, cf_group, status FROM items WHERE canonical_name ILIKE ${p} ORDER BY canonical_name`
  }
  return NextResponse.json(results)
}
