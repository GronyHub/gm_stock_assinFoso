'use client'
import UKTab from '../item/_components/UKTab'

// Orphaned standalone route -- nothing in-app links here any more (UK lives
// at /item?tab=uk, folded into the merged pane), but a direct URL should
// still work rather than crash.
export default function UKPage() {
  return <UKTab />
}
