import { redirect } from 'next/navigation'

// Payslips is a tab on each person's own page in the hub.
export default function Page() {
  redirect('/item?me=payslips')
}
