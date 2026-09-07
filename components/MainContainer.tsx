'use client'
import { usePathname } from 'next/navigation'

// Every protected page shares this wrapper, capped to a readable max-w-5xl
// by default (forms/receipts/lists read better narrow and centered). The
// Item hub is the one exception -- it's a wide dashboard (sidebar + a
// multi-column grid) meant to use the full window, the same way other apps
// keep using 100% of the screen width when you zoom out and only shrink
// text/controls to fit. Capping it the same as everything else meant that
// once zooming out gave the browser more usable width than 1024px, the
// extra space just sat empty on both sides instead of the page using it.
export default function MainContainer({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const isFullWidth = pathname === '/item'
  return (
    <main className={`flex-1 px-4 pt-4 pb-6 mx-auto w-full print:p-0 print:max-w-none ${isFullWidth ? 'max-w-none' : 'max-w-5xl'}`}>
      {children}
    </main>
  )
}
