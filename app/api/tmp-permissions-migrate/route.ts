import sql from '@/lib/db'
import { NextResponse } from 'next/server'

// The 8 features currently gated somewhere in the app by hardcoded
// username/role checks -- becoming the canonical, DB-editable list.
const FEATURE_KEYS = [
  'team', 'users', 'add_category', 'view_portal_as', 'uk', 'ch', 'pl', 'confidential_expenses',
] as const

export async function GET() {
  try {
    const tables = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name IN ('roles', 'role_permissions')
    `
    const existingUsers = await sql`SELECT id, username, role FROM app_users ORDER BY id`
    return NextResponse.json({ existingTables: tables.map(t => t.table_name), existingUsers })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}

export async function POST() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS roles (
        key TEXT PRIMARY KEY,
        label TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `
    await sql`
      CREATE TABLE IF NOT EXISTS role_permissions (
        role_key TEXT NOT NULL REFERENCES roles(key) ON DELETE CASCADE,
        feature_key TEXT NOT NULL,
        allowed BOOLEAN NOT NULL DEFAULT false,
        PRIMARY KEY (role_key, feature_key)
      )
    `
    await sql`
      INSERT INTO roles (key, label) VALUES
        ('owner', 'Owner'), ('manager', 'Manager'), ('staff', 'Staff')
      ON CONFLICT (key) DO NOTHING
    `
    // Owner gets every feature on (though the app also hardcodes an
    // unconditional bypass for role=owner and username=grony as a safety
    // net -- this row is mostly so the Roles screen can display it
    // consistently rather than as a special case). Manager and staff seed
    // to today's real behavior (all off, since "manager" currently does
    // nothing) -- fully editable afterward from the Roles screen.
    for (const role of ['owner', 'manager', 'staff']) {
      for (const feature of FEATURE_KEYS) {
        await sql`
          INSERT INTO role_permissions (role_key, feature_key, allowed)
          VALUES (${role}, ${feature}, ${role === 'owner'})
          ON CONFLICT (role_key, feature_key) DO NOTHING
        `
      }
    }
    const roles = await sql`SELECT * FROM roles ORDER BY key`
    const perms = await sql`SELECT * FROM role_permissions ORDER BY role_key, feature_key`
    return NextResponse.json({ ok: true, roles, perms })
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
