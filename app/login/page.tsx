'use client'
import { signIn } from 'next-auth/react'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const res = await signIn('credentials', { username, password, redirect: false })
    if (res?.error) { setError('Wrong username or password'); setLoading(false) }
    else router.push('/')
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white">Grony</h1>
          <p className="text-gray-400 mt-1 text-sm">Multimedia · Assin Fosu</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-gray-900 rounded-2xl p-6 space-y-4 shadow-xl">
          <div>
            <label className="text-sm text-gray-400 block mb-1">Username</label>
            <input
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={username} onChange={e => setUsername(e.target.value)}
              autoComplete="username" autoFocus
            />
          </div>
          <div>
            <label className="text-sm text-gray-400 block mb-1">Password</label>
            <input
              type="password"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-blue-500"
              value={password} onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold rounded-lg py-3 text-sm transition"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  )
}
