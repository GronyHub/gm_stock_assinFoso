import { redirect } from 'next/navigation'

// Team Logs lives in the Items hub now; old links land there.
export default function Page() {
  redirect('/item?view=logs')
}
