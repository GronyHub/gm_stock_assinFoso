import { redirect } from 'next/navigation'

// The old Checklist History page: past days are read on the To do tab with the day arrows (who did what, when, with what answer).
export default function Page() { redirect('/todo') }
