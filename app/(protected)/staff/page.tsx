import { redirect } from 'next/navigation'

// The old Staff page: times, payslips and profile are tabs on each person's own page in the hub.
export default function StaffPage() {
  redirect('/item?me=times')
}
