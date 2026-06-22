import { auth } from '@/lib/auth'
import sql from '@/lib/db'
import Link from 'next/link'

function Card({ label, value, sub, href }: { label: string; value: string; sub?: string; href?: string }) {
  const inner = (
    <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800 hover:border-gray-700 transition">
      <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-white">{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
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

  const fmt = (n: number) => `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`

  return (
    <div className="py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white">Good day, {session?.user?.name} 👋</h1>
        <p className="text-sm text-gray-500 mt-0.5">{new Date().toDateString()}</p>
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
          <div className="bg-blue-950 border border-blue-800 rounded-2xl p-5 hover:border-blue-600 transition">
            <p className="text-xs text-blue-400 uppercase tracking-wider mb-1">Running Cash at Bank</p>
            <p className="text-3xl font-bold text-white">{fmt(cashRow[0].running_cash_at_bank)}</p>
            <p className="text-xs text-blue-400 mt-1">Tap to see full breakdown →</p>
          </div>
        </Link>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <Link href="/sales/new" className="bg-green-900 hover:bg-green-800 border border-green-700 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">🧾</p>
          <p className="font-semibold text-white">New Receipt</p>
          <p className="text-xs text-green-400 mt-1">Record a sale</p>
        </Link>
        <Link href="/bills/new" className="bg-orange-950 hover:bg-orange-900 border border-orange-800 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">📦</p>
          <p className="font-semibold text-white">New Bill</p>
          <p className="text-xs text-orange-400 mt-1">Record a purchase</p>
        </Link>
        <Link href="/expenses/new" className="bg-purple-950 hover:bg-purple-900 border border-purple-800 rounded-2xl p-5 text-center transition">
          <p className="text-2xl mb-1">💸</p>
          <p className="font-semibold text-white">New Expense</p>
          <p className="text-xs text-purple-400 mt-1">Record a cost</p>
        </Link>
      </div>
    </div>
  )
}
