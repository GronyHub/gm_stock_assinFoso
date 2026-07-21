import { redirect } from 'next/navigation'

// The old standalone dashboard here predates the Grony Cash/Grony Manage
// hub and had no top menu or Role Bar of its own -- login sends everyone
// to "/" first, so any staff member landing here (rather than navigating
// to /item directly, like most testing so far) got a completely different,
// nav-less page. Redirecting keeps this the same for every role: the /item
// hub, top menu first, every time.
export default function RootPage() {
  redirect('/item')
}
