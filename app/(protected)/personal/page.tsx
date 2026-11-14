import { redirect } from 'next/navigation'

// Personal (Payslips, Profile) is each person's own page in the hub now.
export default function PersonalPage() {
  redirect('/item?me=payslips')
}
