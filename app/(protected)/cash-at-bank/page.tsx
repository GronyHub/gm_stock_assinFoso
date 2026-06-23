import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import { fmtDate } from '@/lib/fmtDate'

export default async function CashAtBankPage() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role === 'staff') redirect('/dashboard')

  const rows = await sql`
    SELECT entry_date, cash_counted, grony_personal_cash_in, debtors_cash_in,
           bills, expenses, grony_personal_expenses,
           daily_net, running_cash_at_bank,
           cab_bank, cab_momo, cab_physical, cab_total, deficit
    FROM cash_at_bank_view
    ORDER BY entry_date DESC
    LIMIT 90
  `

  const fmt = (n: any) => n == null ? '—' : `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
  const n = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-GH', { minimumFractionDigits: 0 })
  const nz = (v: any) => (v == null || Number(v) === 0) ? '' : n(v)

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Cash at Bank</h1>
        <p className="text-sm text-gray-600 mt-0.5">Last 90 days · most recent first</p>
      </div>

      {/* Mobile: card list showing essentials */}
      <div className="md:hidden space-y-2">
        {rows.map((r: any) => {
          const hasConfirm = r.cab_total != null
          const net = Number(r.daily_net)
          return (
            <div key={r.entry_date}
              className={`rounded-xl border p-4 space-y-2 ${hasConfirm ? 'bg-blue-950/40 border-blue-800' : 'bg-white border-gray-200'}`}>
              <div className="flex items-center justify-between">
                <span className="text-gray-600 text-sm">{fmtDate(String(r.entry_date).slice(0,10))}</span>
                <span className="text-gray-900 font-bold text-lg">{n(r.running_cash_at_bank)}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Counted: <span className="text-gray-300">{nz(r.cash_counted) || '—'}</span></span>
                <span className={net >= 0 ? 'text-green-400' : 'text-red-400'}>Net: {n(r.daily_net)}</span>
              </div>
              {hasConfirm && (
                <div className="flex items-center justify-between text-sm pt-1 border-t border-blue-800">
                  <span className="text-blue-600">Confirmed: {n(r.cab_total)}</span>
                  {r.deficit != null && (
                    <span className={Number(r.deficit) < 0 ? 'text-red-400' : 'text-green-400'}>
                      Diff: {n(r.deficit)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Desktop: full table */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-white text-gray-600 text-xs uppercase">
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-right">Cash Counted</th>
              <th className="px-3 py-3 text-right">GP In</th>
              <th className="px-3 py-3 text-right">Debtors</th>
              <th className="px-3 py-3 text-right">Bills</th>
              <th className="px-3 py-3 text-right">Expenses</th>
              <th className="px-3 py-3 text-right">GP Out</th>
              <th className="px-3 py-3 text-right">Daily Net</th>
              <th className="px-3 py-3 text-right font-semibold text-gray-900">Running Total</th>
              <th className="px-3 py-3 text-right text-blue-600">Confirmed</th>
              <th className="px-3 py-3 text-right text-red-400">Deficit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const hasConfirm = r.cab_total != null
              return (
                <tr key={r.entry_date}
                  className={`border-t border-gray-200 ${hasConfirm ? 'bg-blue-950/40' : 'hover:bg-white/50'}`}>
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{fmtDate(String(r.entry_date).slice(0,10))}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{nz(r.cash_counted) || '—'}</td>
                  <td className="px-3 py-2 text-right text-green-400">{nz(r.grony_personal_cash_in)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{nz(r.debtors_cash_in)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{nz(r.bills)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{nz(r.expenses)}</td>
                  <td className="px-3 py-2 text-right text-orange-400">{nz(r.grony_personal_expenses)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${Number(r.daily_net) >= 0 ? 'text-gray-900' : 'text-red-400'}`}>
                    {n(r.daily_net)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-gray-900">{n(r.running_cash_at_bank)}</td>
                  <td className="px-3 py-2 text-right text-blue-600">{hasConfirm ? n(r.cab_total) : ''}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.deficit != null && Number(r.deficit) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {r.deficit != null ? n(r.deficit) : ''}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

