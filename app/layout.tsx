import type { Metadata } from 'next'
import './globals.css'
import Providers from '@/components/Providers'
import ActivityToaster from '@/components/ActivityToaster'
import LivePresence from '@/components/LivePresence'

export const metadata: Metadata = { title: 'Grony Multimedia', description: 'Business management' }

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-gray-900 antialiased min-h-screen">
        <Providers>
          <ActivityToaster />
          <LivePresence />
          {children}
        </Providers>
      </body>
    </html>
  )
}
