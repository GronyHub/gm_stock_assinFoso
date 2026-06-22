import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'

export default async function CashAtBankPage() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role === 'staff') redirect('/')

  const rows = await sql`
    SELECT entry_date, cash_counted, grony_personal_cash_in, debtors_cash_in,
           bills, expenses, grony_personal_expenses,
           daily_net, running_cash_at_bank,
           cab_bank, cab_momo, cab_physical, cab_total, deficit
    FROM cash_at_bank_view
    ORDER BY entry_date DESC
    LIMIT 90
  `

  const fmt = (n: any) => n == null ? '—' : `GHS ${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
  const fmtShort = (n: any) => n == null ? '—' : Number(n).toLocaleString('en-GH', { minimumFractionDigits: 0 })

  return (
    <div className="py-6 space-y-4">
      <h1 className="text-xl font-bold">Cash at Bank</h1>
      <p className="text-sm text-gray-400">Last 90 days · most recent first. Confirmation rows highlighted in blue.</p>

      <div className="overflow-x-auto rounded-xl border border-gray-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-900 text-gray-400 text-xs uppercase">
              <th className="px-3 py-3 text-left">Date</th>
              <th className="px-3 py-3 text-right">Cash Counted</th>
              <th className="px-3 py-3 text-right">GP In</th>
              <th className="px-3 py-3 text-right">Debtors</th>
              <th className="px-3 py-3 text-right">Bills</th>
              <th className="px-3 py-3 text-right">Expenses</th>
              <th className="px-3 py-3 text-right">GP Out</th>
              <th className="px-3 py-3 text-right">Daily Net</th>
              <th className="px-3 py-3 text-right font-semibold text-white">Running Total</th>
              <th className="px-3 py-3 text-right text-blue-400">Confirmed</th>
              <th className="px-3 py-3 text-right text-red-400">Deficit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const hasConfirm = r.cab_total != null
              return (
                <tr key={r.entry_date}
                  className={`border-t border-gray-800 ${hasConfirm ? 'bg-blue-950/40' : 'hover:bg-gray-900/50'}`}>
                  <td className="px-3 py-2 text-gray-300 whitespace-nowrap">{String(r.entry_date).slice(0,10)}</td>
                  <td className="px-3 py-2 text-right text-gray-300">{fmtShort(r.cash_counted)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{fmtShort(r.grony_personal_cash_in) === '0' ? '' : fmtShort(r.grony_personal_cash_in)}</td>
                  <td className="px-3 py-2 text-right text-green-400">{fmtShort(r.debtors_cash_in) === '0' ? '' : fmtShort(r.debtors_cash_in)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{fmtShort(r.bills) === '0' ? '' : fmtShort(r.bills)}</td>
                  <td className="px-3 py-2 text-right text-red-400">{fmtShort(r.expenses) === '0' ? '' : fmtShort(r.expenses)}</td>
                  <td className="px-3 py-2 text-right text-orange-400">{fmtShort(r.grony_personal_expenses) === '0' ? '' : fmtShort(r.grony_personal_expenses)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${Number(r.daily_net) >= 0 ? 'text-white' : 'text-red-400'}`}>
                    {fmtShort(r.daily_net)}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-white">{fmtShort(r.running_cash_at_bank)}</td>
                  <td className="px-3 py-2 text-right text-blue-300">{hasConfirm ? fmtShort(r.cab_total) : ''}</td>
                  <td className={`px-3 py-2 text-right font-medium ${r.deficit != null && Number(r.deficit) < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    {r.deficit != null ? fmtShort(r.deficit) : ''}
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
