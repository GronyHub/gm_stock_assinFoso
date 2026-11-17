import { NextRequest } from 'next/server'
import { getAuthUser, badRequest, success, handleError } from '@/lib/api'
import { isOwnerLevel } from '@/lib/roles'
import { checkPin, pinStatus, resetPin, setPin, validPin } from '@/lib/profilePin'
import { recordActivity } from '@/lib/logger'

// The signed-in person's own 4-digit PIN for their profile window. GET: is one set (and is it locked). POST: set, verify, change; the owner and Joe can also reset someone's.
export async function GET() {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    return success(await pinStatus(String(user!.username ?? user!.name ?? '')))
  } catch (e) { return handleError('profile-pin GET', e) }
}

export async function POST(req: NextRequest) {
  const { user, error } = await getAuthUser()
  if (error) return error
  try {
    const me = String(user!.username ?? user!.name ?? '')
    const body = await req.json().catch(() => ({})) as { action?: string; pin?: string; currentPin?: string; username?: string }
    const status = await pinStatus(me)

    if (body.action === 'reset') {
      if (!isOwnerLevel(user as never)) return badRequest('Only the owner or Joe can reset a PIN')
      const who = String(body.username ?? '').trim()
      if (!who) return badRequest('Who?')
      await resetPin(who)
      void recordActivity(me, 'reset a profile PIN', who)
      return success({ ok: true })
    }

    if (body.action === 'verify') {
      if (!validPin(body.pin)) return badRequest('The PIN is 4 digits')
      const r = await checkPin(me, body.pin)
      if (r.result === 'locked') return success({ ok: false, locked: true, minutes: r.minutes })
      if (r.result === 'wrong') return success({ ok: false, left: r.left })
      return success({ ok: true })
    }

    if (body.action === 'set' || body.action === 'change') {
      if (!validPin(body.pin)) return badRequest('The PIN is 4 digits')
      if (status.hasPin) {
        if (!validPin(body.currentPin)) return badRequest('Enter your current PIN')
        const r = await checkPin(me, body.currentPin)
        if (r.result === 'locked') return success({ ok: false, locked: true, minutes: r.minutes })
        if (r.result === 'wrong') return success({ ok: false, left: r.left })
      }
      await setPin(me, body.pin)
      void recordActivity(me, status.hasPin ? 'changed their profile PIN' : 'set a profile PIN', '')
      return success({ ok: true })
    }
    return badRequest('Unknown action')
  } catch (e) { return handleError('profile-pin POST', e) }
}
