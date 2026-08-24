import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import sql from '@/lib/db'
import bcrypt from 'bcryptjs'
import { NextRequest } from 'next/server'

export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error

  try {
    const [userData] = await sql`
      SELECT id, username, display_name, email, phone, role, created_at
      FROM app_users WHERE id = ${user.id}
    `
    return success(userData)
  } catch (e) {
    return handleError('profile GET', e)
  }
}

export async function PUT(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error

  const { display_name, email, phone, password, confirm } = await req.json()

  try {
    if (password) {
      if (password.length < 6) return badRequest('Password must be at least 6 characters')
      if (password !== confirm) return badRequest('Passwords do not match')
      const hash = await bcrypt.hash(password, 12)
      await sql`UPDATE app_users SET password_hash = ${hash} WHERE id = ${user.id}`
    }

    await sql`
      UPDATE app_users
      SET display_name = ${display_name},
          email = ${email || null},
          phone = ${phone || null}
      WHERE id = ${user.id}
    `

    const [updated] = await sql`
      SELECT id, username, display_name, email, phone, role, created_at
      FROM app_users WHERE id = ${user.id}
    `
    return success(updated)
  } catch (e) {
    return handleError('profile PUT', e)
  }
}
