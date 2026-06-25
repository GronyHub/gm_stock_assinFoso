'use client'
import { useEffect } from 'react'

export default function SalesError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error('Sales error:', error.message, error.digest) }, [error])
  return (
    <div className="py-12 text-center space-y-3">
      <p className="text-red-600 font-semibold text-sm">Something went wrong loading this page</p>
      <p className="text-xs text-gray-400 font-mono break-all px-4">{error.message}</p>
      <button onClick={reset} className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-semibold">
        Try again
      </button>
    </div>
  )
}
