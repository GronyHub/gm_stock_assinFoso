import { redirect } from 'next/navigation'

// Replaced by the Items hub (sidebar + staff bar stay on screen): old links and bookmarks land on the matching hub view.
export default function Page() {
  redirect('/item?view=counts')
}
