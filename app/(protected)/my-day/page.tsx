import { redirect } from 'next/navigation'

// Waiting for me is the first tab of each person's own page in the hub.
export default function MyDayPage() {
  redirect('/item?me=waiting')
}
