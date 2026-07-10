import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import Link from 'next/link'

function Card({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <div className="bg-white rounded-2xl p-5 border border-gray-200 hover:border-gray-300 transition">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
  return href ? <Link href={href}>{inner}</Link> : inner
}

export default async function DashboardPage() {
  const session = await auth()
  const role = (session?.user as any)?.role
  const today = new Date().toISOString().slice(0, 10)

  const [receiptsToday, billsToday, expToday, stockAlerts, cashRow] = await Promise.all([
    sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total FROM sales_receipts WHERE receipt_date = ${today}`,
    sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(total),0) AS total FROM bills WHERE bill_date = ${today}`,
    sql`SELECT COUNT(*) AS cnt, COALESCE(SUM(COALESCE(total,amount)),0) AS total FROM expenses WHERE expense_date = ${today}`,
    sql`SELECT COUNT(*) AS cnt FROM item_stock_summary WHERE calculated_soh < 5 AND calculated_soh IS NOT NULL`,
    role !== 'staff'
      ? sql`SELECT running_cash_at_bank FROM cash_at_bank_view ORDER BY entry_date DESC LIMIT 1`
      : Promise.resolve([]),
  ])

  const fmt = (n: number) => `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Good day, {session?.user?.name} 👋</h1>
        <p className="text-sm text-gray-400 mt-0.5">{new Date().toDateString()}</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card label="Receipts today" value={String(receiptsToday[0].cnt)}
          sub={fmt(receiptsToday[0].total)} href="/sales/new" />
        <Card label="Bills today" value={String(billsToday[0].cnt)}
          sub={fmt(billsToday[0].total)} href="/bills/new" />
        <Card label="Expenses today" value={String(expToday[0].cnt)}
          sub={fmt(expToday[0].total)} href="/expenses/new" />
        <Card label="Low stock items" value={String(stockAlerts[0].cnt)} href="/stock" />
      </div>

      {role !== 'staff' && cashRow.length > 0 && (
        <Link href="/cash-at-bank">
          <div className="bg-brand-light border border-blue-100 rounded-2xl p-5 hover:border-brand/40 transition">
            <p className="text-xs text-brand uppercase tracking-wider mb-1">Running Cash at Bank</p>
            <p className="text-3xl font-bold text-gray-900">{fmt(cashRow[0].running_cash_at_bank)}</p>
            <p className="text-xs text-brand mt-1">Tap to see full breakdown →</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/sales/new" className="bg-success-light hover:border-success/40 border border-emerald-100 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">🧾</p>
          <p className="font-semibold text-gray-900">New Receipt</p>
          <p className="text-xs text-success mt-1">Record a sale</p>
        </Link>
        <Link href="/bills/new" className="bg-warning-light hover:border-warning/40 border border-amber-100 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">📦</p>
          <p className="font-semibold text-gray-900">New Bill</p>
          <p className="text-xs text-warning mt-1">Record a purchase</p>
        </Link>
        <Link href="/expenses/new" className="bg-info-light hover:border-info/40 border border-violet-100 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">💸</p>
          <p className="font-semibold text-gray-900">New Expense</p>
          <p className="text-xs text-info mt-1">Record a cost</p>
        </Link>
      </div>
    </div>
  )
}

