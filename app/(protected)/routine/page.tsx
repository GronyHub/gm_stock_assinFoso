import { redirect } from 'next/navigation'

// The Shop Routine's Opening / Daytime / Closing lists are now the Daily Checklist (built from the Company Laws), so there is one list to follow.
export default function Page() {
  redirect('/standards')
}
