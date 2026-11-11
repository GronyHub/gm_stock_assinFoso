import { redirect } from 'next/navigation'

// The team's times are the Shop's Times tab now: old links and bookmarks open it there.
export default function Page() {
  redirect('/item?open=' + encodeURIComponent('/staff-times'))
}
