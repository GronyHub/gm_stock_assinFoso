import { redirect } from 'next/navigation'

// Profile is a tab on each person's own page in the hub (?me= opens it, see useHubState).
export default function ProfilePage() {
  redirect('/item?me=profile')
}
