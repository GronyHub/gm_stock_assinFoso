import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import { isOwnerLevel } from '@/lib/roles'
import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionUser = session.user as any
  const username: string = sessionUser?.username ?? sessionUser?.name ?? ''

  // owner and joe see all; others see only their own profile
  const canSeeAll = isOwnerLevel(sessionUser)

  const rows = canSeeAll
    ? await sql`
        SELECT id, staff_name, full_name, start_date::text, date_of_birth::text,
               ghana_card, ssnit_number, phone, address,
               bank_name, bank_account, momo_number
        FROM staff_profiles ORDER BY staff_name
      `
    : await sql`
        SELECT id, staff_name, full_name, start_date::text, date_of_birth::text,
               ghana_card, ssnit_number, phone, address,
               bank_name, bank_account, momo_number
        FROM staff_profiles WHERE LOWER(staff_name) = LOWER(${username})
      `

  return NextResponse.json(rows)
}

export async function PUT(req: NextRequest) {
  const session = await auth()
  const sessionUser = session?.user as any
  const isAdmin = isOwnerLevel(sessionUser)
  const sessionUsername: string = sessionUser?.username ?? sessionUser?.name ?? ''

  const body = await req.json()
  const { staff_name, full_name, start_date, date_of_birth, ghana_card,
          ssnit_number, phone, address, bank_name, bank_account, momo_number } = body

  // Allow self-update: staff can edit their own profile row
  const isSelf = staff_name?.toLowerCase() === sessionUsername?.toLowerCase()
  if (!isAdmin && !isSelf) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [row] = await sql`
    UPDATE staff_profiles SET
      full_name     = ${full_name     ?? null},
      start_date    = ${start_date    ?? null},
      date_of_birth = ${date_of_birth ?? null},
      ghana_card    = ${ghana_card    ?? null},
      ssnit_number  = ${ssnit_number  ?? null},
      phone         = ${phone         ?? null},
      address       = ${address       ?? null},
      bank_name     = ${bank_name     ?? null},
      bank_account  = ${bank_account  ?? null},
      momo_number   = ${momo_number   ?? null},
      updated_at    = NOW()
    WHERE staff_name = ${staff_name}
    RETURNING id, staff_name, full_name, start_date::text, date_of_birth::text,
              ghana_card, ssnit_number, phone, address,
              bank_name, bank_account, momo_number
  `
  return NextResponse.json(row)
}
