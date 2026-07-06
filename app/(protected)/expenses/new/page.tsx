'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

const ACCOUNTS = ['Office Expenses','Rent','Utilities','Salaries','Transport','Repairs','Supplies','Other']

export default function NewExpensePage({ onSuccess }: { onSuccess?: () => void } = {}) {
  usePresenceReporter('entering an expense')
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [account, setAccount] = useState('Other')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !description) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          expense_date: date,
          expense_account: account,
          cf_justify: description,
          amount: Number(amount),
        }),
      })
      const d = await res.json().catch(() => ({}))
      setSaving(false)
      if (res.ok) {
        setDone(true)
        setTimeout(() => onSuccess ? onSuccess() : router.push('/dashboard'), 1200)
      } else {
        setError(d.error || 'Could not save expense. Please try again.')
      }
    } catch {
      setSaving(false)
      setError('Network error — could not reach the server. Please try again.')
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-5xl mb-4">✅</p>
      <p className="text-gray-900 font-semibold text-lg">Expense saved!</p>
    </div>
  )

  return (
    <div className="py-4 max-w-lg space-y-4">
      <h1 className="text-xl font-bold">New Expense</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)}
            placeholder="What was this expense for?"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Category</label>
          <input list="expense-accounts-new" value={account} onChange={e => setAccount(e.target.value)}
            placeholder="e.g. Rent, or type your own"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          <datalist id="expense-accounts-new">
            {ACCOUNTS.map(a => <option key={a} value={a} />)}
          </datalist>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Amount (₵)</label>
          <input type="number" min="0" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00"
            inputMode="decimal"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
        <button type="submit" disabled={!description || !amount || saving}
          className="w-full bg-purple-600 hover:bg-purple-500 active:bg-purple-700 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-base transition">
          {saving ? 'Saving…' : 'Save Expense'}
        </button>
      </form>
    </div>
  )
}

