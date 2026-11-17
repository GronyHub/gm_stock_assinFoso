import { randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import sql from '@/lib/db'
import { once } from '@/lib/once'

// A staff member's own 4-digit PIN for their profile window (payslips, profile, settings). Only a salted hash is kept, never the PIN.
// Five wrong tries lock it for 15 minutes. The owner or Joe can reset someone's PIN (they set a new one on the next visit).

const MAX_TRIES = 5
const LOCK_MINUTES = 15

export const ensureProfilePins = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS staff_pins (
    username TEXT PRIMARY KEY, salt TEXT NOT NULL, pin_hash TEXT NOT NULL, tries INTEGER NOT NULL DEFAULT 0, locked_until TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
})

const hash = (pin: string, salt: string) => scryptSync(pin, salt, 32).toString('hex')
export const validPin = (pin: unknown): pin is string => typeof pin === 'string' && /^\d{4}$/.test(pin)
const key = (u: string) => u.trim().toLowerCase()

export async function pinStatus(username: string): Promise<{ hasPin: boolean; lockedMinutes: number }> {
  await ensureProfilePins()
  const [r] = await sql`SELECT locked_until FROM staff_pins WHERE username = ${key(username)}`
  if (!r) return { hasPin: false, lockedMinutes: 0 }
  const until = r.locked_until ? new Date(r.locked_until).getTime() : 0
  return { hasPin: true, lockedMinutes: until > Date.now() ? Math.ceil((until - Date.now()) / 60000) : 0 }
}

export async function setPin(username: string, pin: string) {
  await ensureProfilePins()
  const salt = randomBytes(16).toString('hex')
  await sql`INSERT INTO staff_pins (username, salt, pin_hash, tries, locked_until, updated_at) VALUES (${key(username)}, ${salt}, ${hash(pin, salt)}, 0, NULL, now())
    ON CONFLICT (username) DO UPDATE SET salt = ${salt}, pin_hash = ${hash(pin, salt)}, tries = 0, locked_until = NULL, updated_at = now()`
}

export async function resetPin(username: string) {
  await ensureProfilePins()
  await sql`DELETE FROM staff_pins WHERE username = ${key(username)}`
}

// 'ok', 'wrong' (with tries left), 'locked' (with minutes left) or 'none' (no PIN set).
export async function checkPin(username: string, pin: string): Promise<{ result: 'ok' | 'none' } | { result: 'wrong'; left: number } | { result: 'locked'; minutes: number }> {
  await ensureProfilePins()
  const u = key(username)
  const [r] = await sql`SELECT salt, pin_hash, tries, locked_until FROM staff_pins WHERE username = ${u}`
  if (!r) return { result: 'none' }
  const until = r.locked_until ? new Date(r.locked_until).getTime() : 0
  if (until > Date.now()) return { result: 'locked', minutes: Math.ceil((until - Date.now()) / 60000) }
  const given = Buffer.from(hash(pin, String(r.salt)), 'hex'), stored = Buffer.from(String(r.pin_hash), 'hex')
  if (given.length === stored.length && timingSafeEqual(given, stored)) {
    if (Number(r.tries) > 0 || r.locked_until) await sql`UPDATE staff_pins SET tries = 0, locked_until = NULL WHERE username = ${u}`
    return { result: 'ok' }
  }
  const tries = Number(r.tries) + 1
  if (tries >= MAX_TRIES) {
    await sql`UPDATE staff_pins SET tries = 0, locked_until = now() + make_interval(mins => ${LOCK_MINUTES}::int) WHERE username = ${u}`
    return { result: 'locked', minutes: LOCK_MINUTES }
  }
  await sql`UPDATE staff_pins SET tries = ${tries} WHERE username = ${u}`
  return { result: 'wrong', left: MAX_TRIES - tries }
}
