'use client'

// A brief "Saved" confirmation next to a save action, shown for a couple
// seconds after it succeeds. Every quiet-save flow here (log entries, free-
// text notes, new categories/tabs) previously gave no feedback beyond the
// button re-enabling and the new content appearing somewhere on screen --
// easy to miss, especially on a page that already scrolled or when the new
// row lands below the fold. This makes "did that actually save?" explicit
// without a global toast system, which is for other people's actions (see
// ActivityToaster), not confirming your own.
export default function SavedFlash({ show }: { show: boolean }) {
  if (!show) return null
  return <span className="text-[10px] font-semibold text-green-600">✓ Saved</span>
}
