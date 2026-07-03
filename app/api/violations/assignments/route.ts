import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { logActivity } from '@/lib/logger'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  try {
    const [assignments, settings] = await Promise.all([
      sql`SELECT violation_type, staff_name, deadline FROM violation_assignments`,
      sql`SELECT key, value FROM violation_settings`,
    ])
    const assignmentMap: Record<string, string> = {}
    const deadlineMap: Record<string, string> = {}
    for (const r of assignments) {
      assignmentMap[r.violation_type] = r.staff_name
      if (r.deadline) deadlineMap[r.violation_type] = String(r.deadline).slice(0, 10)
    }
    const settingsMap: Record<string, string> = {}
    for (const r of settings) settingsMap[r.key] = r.value
    return NextResponse.json({ assignments: assignmentMap, deadlines: deadlineMap, settings: settingsMap })
  } catch (e) {
    console.error('violation assignments GET error:', e)
    return NextResponse.json({ assignments: {}, deadlines: {}, settings: {} })
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const role = (session.user as any)?.role
  if (!['owner', 'manager'].includes(role)) {
    return NextResponse.json({ error: 'Only owner or manager can change assignments' }, { status: 403 })
  }

  try {
    const { violation_type, staff_name, violation_label, deadline, settings } = await req.json()

    if (violation_type) {
      if (staff_name) {
        const [existing] = await sql`SELECT 1 FROM violation_assignments WHERE violation_type = ${violation_type}`
        if (existing) {
          await sql`UPDATE violation_assignments SET staff_name = ${staff_name}, deadline = ${deadline || null} WHERE violation_type = ${violation_type}`
        } else {
          await sql`INSERT INTO violation_assignments (violation_type, staff_name, deadline) VALUES (${violation_type}, ${staff_name}, ${deadline || null})`
        }
        const actor = session.user?.name || (session.user as any)?.username || 'Unknown'
        const label = violation_label || violation_type
        const deadlineNote = deadline ? ` (deadline ${deadline})` : ''
        await logActivity(actor, 'assigned task', `'${label}' to ${staff_name}${deadlineNote}`)
      } else {
        await sql`DELETE FROM violation_assignments WHERE violation_type = ${violation_type}`
      }
    }

    if (settings && typeof settings === 'object') {
      for (const [key, value] of Object.entries(settings)) {
        const [existing] = await sql`SELECT 1 FROM violation_settings WHERE key = ${key}`
        if (existing) {
          await sql`UPDATE violation_settings SET value = ${String(value)} WHERE key = ${key}`
        } else {
          await sql`INSERT INTO violation_settings (key, value) VALUES (${key}, ${String(value)})`
        }
      }
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('violation assignments POST error:', e)
    const detail = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: `Could not save: ${detail}` }, { status: 500 })
  }
}
