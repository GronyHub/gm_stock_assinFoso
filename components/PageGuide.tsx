'use client'
import { areaForGuide } from '@/lib/lawAreas'

// The button that used to open a page's guide video. Everything about a page (laws, sanctions, why, how to, video, quiz)
// now lives on its tile in Company Laws, so this is just a link there.
export default function PageGuide({ page }: { page: string }) {
  const area = areaForGuide(page)
  if (!area) return null
  return (
    <a href={`/laws?tile=${area.key}`} title={`The laws, sanctions and how-to for ${area.label}`}
      className="shrink-0 rounded-lg bg-indigo-50 px-2 py-1 text-[10px] font-bold text-indigo-700 hover:bg-indigo-100">📜 Laws</a>
  )
}
