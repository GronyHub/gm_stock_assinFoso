'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

const ACCOUNTS = ['Office Expenses','Rent','Utilities','Salaries','Transport','Repairs','Supplies','Other']

export default function NewExpensePage() {
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10))
  const [description, setDescription] = useState('')
  const [account, setAccount] = useState('Other')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const router = useRouter()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amount || !description) return
    setSaving(true)
    const res = await fetch('/api/expenses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, description, account, amount: Number(amount) }),
    })
    setSaving(false)
    if (res.ok) { setDone(true); setTimeout(() => router.push('/dashboard'), 1200) }
  }

  if (done) return <div className="py-20 text-center"><p className="text-4xl mb-3">✅</p><p className="text-white font-semibold">Expense saved!</p></div>

  return (
    <div className="py-6 max-w-lg space-y-5">
      <h1 className="text-xl font-bold">New Expense</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-400 block mb-1">Date</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Description</label>
          <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What was this expense for?"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Account / Category</label>
          <select value={account} onChange={e => setAccount(e.target.value)}
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white outline-none focus:ring-2 focus:ring-blue-500">
            {ACCOUNTS.map(a => <option key={a}>{a}</option>)}
          </select>
        </div>
        <div>
          <label className="text-sm text-gray-400 block mb-1">Amount (GHS)</label>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
            className="w-full bg-gray-900 border border-gray-700 rounded-lg px-4 py-2.5 text-sm text-white placeholder-gray-500 outline-none focus:ring-2 focus:ring-blue-500" />
        </div>
        <button type="submit" disabled={!description || !amount || saving}
          className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-semibold rounded-lg py-3 text-sm transition">
          {saving ? 'Saving…' : 'Save Expense'}
        </button>
      </form>
    </div>
  )
}
