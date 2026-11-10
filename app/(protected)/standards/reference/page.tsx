import { redirect } from 'next/navigation'

// The printable standards list is retired: the Company Laws are the one source and the Daily Checklist is the one place to tick.
export default function ReferenceRedirect() { redirect('/standards') }
