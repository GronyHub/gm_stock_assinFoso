import { redirect } from 'next/navigation'

// Tasks are no longer made here: every task is a recurring law with a time, so it is added and changed in the Company Laws.
export default function ManageTilesRedirect() { redirect('/todo') }
