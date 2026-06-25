import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import sql from '@/lib/db'
import CashAtBankClient from './CashAtBankClient'

export default async function CashAtBankPage() {
  const session = await auth()
  const role = (session?.user as any)?.role
  if (role === 'staff') redirect('/stock/counts?tab=Daily')

  const rows = await sql`
    SELECT entry_date, cash_counted, grony_personal_cash_in, debtors_cash_in,
           bills, expenses, grony_personal_expenses,
           daily_net, running_cash_at_bank,
           cab_bank, cab_momo, cab_physical, cab_total, deficit
    FROM cash_at_bank_view
    ORDER BY entry_date DESC
    LIMIT 90
  `

  return <CashAtBankClient rows={rows as any} />
}
