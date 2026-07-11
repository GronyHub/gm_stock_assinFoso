'use client'
import { useState, useEffect } from 'react'
import { usePresenceReporter } from '@/lib/usePresenceReporter'

export default function NewItemForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  usePresenceReporter('adding an item')
  const [itemName, setItemName] = useState('')
  const [productType, setProductType] = useState<'goods' | 'service'>('goods')
  const [group, setGroup] = useState('')
  const [groups, setGroups] = useState<string[]>([])
  const [sellingRate, setSellingRate] = useState('')
  const [purchaseRate, setPurchaseRate] = useState('')
  const [unitsPerPack, setUnitsPerPack] = useState('')
  const [unitName, setUnitName] = useState('')
  const [saving, setSaving] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch('/api/items').then(r => r.json())
      .then((d: { cf_group: string | null }[]) => {
        if (!Array.isArray(d)) return
        setGroups(Array.from(new Set(d.map(i => i.cf_group).filter((g): g is string => !!g))).sort())
      })
      .catch(() => {})
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!itemName.trim()) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/items', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_name: itemName.trim(),
          product_type: productType,
          cf_group: group.trim() || null,
          selling_rate: sellingRate ? parseFloat(sellingRate) : null,
          purchase_rate: purchaseRate ? parseFloat(purchaseRate) : null,
          units_per_pack: unitsPerPack ? parseFloat(unitsPerPack) : null,
          unit_name: unitName.trim() || null,
        }),
      })
      const d = await res.json().catch(() => ({}))
      setSaving(false)
      if (res.ok) {
        setDone(true)
        setTimeout(() => onSuccess?.(), 1000)
      } else {
        setError(d.error || 'Could not save item. Please try again.')
      }
    } catch {
      setSaving(false)
      setError('Network error — could not reach the server. Please try again.')
    }
  }

  if (done) return (
    <div className="py-20 text-center">
      <p className="text-5xl mb-4">✅</p>
      <p className="text-gray-900 font-semibold text-lg">Item saved!</p>
    </div>
  )

  return (
    <div className="py-4 max-w-lg space-y-4">
      <h1 className="text-xl font-bold">New Item</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Item name</label>
          <input value={itemName} onChange={e => setItemName(e.target.value)}
            placeholder="e.g. A4 Sheets Double A"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Type</label>
          <div className="flex gap-2">
            <button type="button" onClick={() => setProductType('goods')}
              className={`flex-1 font-semibold py-3 rounded-xl transition
                ${productType === 'goods' ? 'bg-teal-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Good
            </button>
            <button type="button" onClick={() => setProductType('service')}
              className={`flex-1 font-semibold py-3 rounded-xl transition
                ${productType === 'service' ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              Service
            </button>
          </div>
        </div>
        <div>
          <label className="text-sm text-gray-600 block mb-1.5">Group</label>
          <input list="new-item-groups" value={group} onChange={e => setGroup(e.target.value)}
            placeholder="e.g. Paper, or type your own"
            className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          <datalist id="new-item-groups">
            {groups.map(g => <option key={g} value={g} />)}
          </datalist>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Selling rate (₵)</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={sellingRate}
              onChange={e => setSellingRate(e.target.value)} placeholder="0.00"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Cost rate (₵)</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={purchaseRate}
              onChange={e => setPurchaseRate(e.target.value)} placeholder="0.00"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Units/pack</label>
            <input type="number" min="0" step="0.01" inputMode="decimal" value={unitsPerPack}
              onChange={e => setUnitsPerPack(e.target.value)} placeholder="e.g. 500"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div>
            <label className="text-sm text-gray-600 block mb-1.5">Unit</label>
            <input value={unitName} onChange={e => setUnitName(e.target.value)} placeholder="e.g. sheets"
              className="w-full bg-white border border-gray-300 rounded-xl px-4 py-3 text-base text-gray-900 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
        </div>
        {error && <p className="text-sm text-red-500 font-medium text-center">{error}</p>}
        <button type="submit" disabled={!itemName.trim() || saving}
          className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl py-4 text-base transition">
          {saving ? 'Saving…' : 'Save Item'}
        </button>
      </form>
    </div>
  )
}
