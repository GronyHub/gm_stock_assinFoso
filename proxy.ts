import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOwnerLevel } from '@/lib/roles'

// The caretaker account (role children_manager) must never read or change shop
// data: sales, bills, customers, payroll, the owners' personal ledger, the UK
// area and the like. Those APIs answer her with 403 (and an empty list for
// reads, so screens that expect an array stay calm). Everything else -- the
// care pages, C&H logs, login, notifications -- is untouched. Any failure in
// this check lets the request through rather than blocking the whole app.
const CARETAKER_BLOCKED = [
  '/api/sales', '/api/bills', '/api/bill-lines', '/api/expenses', '/api/customers', '/api/receipts',
  '/api/purchase-orders', '/api/vendors', '/api/payslips', '/api/personal', '/api/cash-at-bank',
  '/api/accounts', '/api/losses', '/api/analysis', '/api/daily-summary', '/api/stock', '/api/items',
  '/api/packs', '/api/gmc-packs', '/api/gmc-conversions', '/api/good-service-matches',
  '/api/staff-times', '/api/rota', '/api/roles', '/api/users', '/api/impersonate', '/api/uk',
  '/api/expense-orders', '/api/properties', '/api/search', '/api/flags', '/api/advert-status',
]

// Staff (everyone except the owner and Joe) only use Items / Live Sale / Sales Log, Counts, Item 360, Losses,
// Analytics, Company Laws, the Daily Checklist, their payslips and profile. These pages are not for them: a typed
// address quietly lands on Items. The data behind them is refused too.
const STAFF_BLOCKED_PAGES = ['/expenses', '/cash-at-bank', '/purchase-orders', '/vendors', '/personal', '/roles', '/users', '/penalties', '/cctv-review', '/barcode-labels', '/integrity', '/routine', '/notifications', '/owner-guide', '/handbook-announcements']
const STAFF_BLOCKED_API = ['/api/cash-at-bank', '/api/personal', '/api/properties', '/api/uk', '/api/impersonate', '/api/expense-orders']
const under = (path: string, list: string[]) => list.some(p => path === p || path.startsWith(p + '/'))

export const proxy = auth(req => {
  try {
    const role = (req.auth?.user as { role?: string } | undefined)?.role
    const path = req.nextUrl.pathname
    if (role === 'children_manager' && path.startsWith('/api/')
        && CARETAKER_BLOCKED.some(p => path === p || path.startsWith(p + '/'))) {
      return NextResponse.json(req.method === 'GET' ? [] : { error: 'Not available for this account' }, { status: 403 })
    }
    const u = req.auth?.user as { role?: string; username?: string; name?: string } | undefined
    if (u && u.role !== 'children_manager' && !isOwnerLevel(u)) {
      if (path.startsWith('/api/')) {
        if (under(path, STAFF_BLOCKED_API)) return NextResponse.json(req.method === 'GET' ? [] : { error: 'Not available for this account' }, { status: 403 })
      } else if (under(path, STAFF_BLOCKED_PAGES)) {
        return NextResponse.redirect(new URL('/item', req.nextUrl))
      }
    }
  } catch { /* never block the app because of this check */ }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|api/public|adverts|login|_next/static|_next/image|favicon.ico).*)'],
}
