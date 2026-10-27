import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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

export const proxy = auth(req => {
  try {
    const role = (req.auth?.user as { role?: string } | undefined)?.role
    const path = req.nextUrl.pathname
    if (role === 'children_manager' && path.startsWith('/api/')
        && CARETAKER_BLOCKED.some(p => path === p || path.startsWith(p + '/'))) {
      return NextResponse.json(req.method === 'GET' ? [] : { error: 'Not available for this account' }, { status: 403 })
    }
  } catch { /* never block the app because of this check */ }
  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!api/auth|api/public|login|_next/static|_next/image|favicon.ico).*)'],
}
