'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    setLoading(false)
    if (res.ok) setSent(true)
    else {
      const d = await res.json().catch(() => ({}))
      setError(d.error || 'Something went wrong. Please try again.')
    }
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Grony</h1>
          <p className="text-gray-600 mt-1 text-sm">Multimedia &middot; Assin Fosu</p>
        </div>
        <div className="bg-white rounded-2xl p-6 shadow-xl">
          {sent ? (
            <div className="text-center space-y-3">
              <p className="text-2xl">&#x2709;&#xFE0F;</p>
              <p className="font-semibold text-gray-900">Check your email</p>
              <p className="text-sm text-gray-500">
                If <strong>{email}</strong> is registered, a reset link has been sent. Check your inbox (and spam folder).
              </p>
              <Link href="/login" className="block mt-4 text-blue-600 text-sm hover:underline">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <h2 className="text-lg font-bold text-gray-900 mb-1">Forgot password</h2>
                <p className="text-sm text-gray-500">Enter your email and we'll send a reset link.</p>
              </div>
              <div>
                <label className="text-sm text-gray-600 block mb-1">Email address</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  required autoFocus
                  className="w-full bg-gray-100 text-gray-900 rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="you@example.com"
                />
              </div>
              {error && <p className="text-red-400 text-sm">{error}</p>}
              <button type="submit" disabled={loading}
                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition">
                {loading ? 'Sending...' : 'Send reset link'}
              </button>
              <p className="text-center text-sm">
                <Link href="/login" className="text-gray-400 hover:text-gray-600">Back to sign in</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
