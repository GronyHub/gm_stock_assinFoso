import type { Metadata, Viewport } from 'next'
import './globals.css'
import Providers from '@/components/Providers'
import ClientWidgets from '@/components/ClientWidgets'

export const metadata: Metadata = {
  title: 'Grony Multimedia',
  description: 'Business management',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple: '/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#2563eb',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-slate-50 text-gray-900 antialiased min-h-screen">
        <Providers>
          <ClientWidgets />
          {children}
        </Providers>
      </body>
    </html>
  )
}
