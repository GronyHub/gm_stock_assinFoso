'use client'
import UKTab from '../item/_components/UKTab'
import { useUKData } from '../item/_components/ukViewData'

// Orphaned standalone route -- nothing in-app links here any more (UK lives
// at /item?tab=uk, folded into the merged pane), but a direct URL should
// still work rather than crash, so this calls the same hook item/page.tsx
// does instead of passing UKTab nothing.
export default function UKPage() {
  const uk = useUKData()
  return <UKTab uk={uk} />
}
