import { redirect } from 'next/navigation'

// The old year-long plan page: the To do tab's "Coming up" now shows the days ahead.
export default function Page() { redirect('/todo') }
