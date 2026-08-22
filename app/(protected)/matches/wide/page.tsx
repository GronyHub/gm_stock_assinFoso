'use client'
import { useState, useEffect, useMemo } from 'react'

type MatchRow = { id: number; service_name: string; service_group: string | null; goods_name: string; goods_group: string | null }

// Unified table view of all good<->service matches
export default function MatchesWidePage() {
  const [matches, setMatches] = useState<MatchRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [addingService, setAddingService] = useState('')
  const [addingGoods, setAddingGoods] = useState('')
  const [adding, setAdding] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [allServices, setAllServices] = useState<{ name: string; group: string | null }[]>([])
  const [allGoods, setAllGoods] = useState<{ name: string; group: string | null }[]>([])

  useEffect(() => { load() }, [])

  async function load() {
    setLoading(true)
    try {
      const matchesData = await fetch('/api/good-service-matches/wide').then(r => r.json())
      const matchArray = Array.isArray(matchesData) ? matchesData : []
      setMatches(matchArray)

      const services = Array.from(new Map(
        matchArray.map(m => [m.service_name, { name: m.service_name, group: m.service_group }])
      ).values())
      const goods = Array.from(new Map(
        matchArray.map(m => [m.goods_name, { name: m.goods_name, group: m.goods_group }])
      ).values())

      setAllServices(services)
      setAllGoods(goods)
    } catch (e) {
      console.error('Error loading data:', e)
    }
    setLoading(false)
  }

  const filtered = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return matches
    return matches.filter(m =>
      m.service_name.toLowerCase().includes(q) ||
      m.goods_name.toLowerCase().includes(q) ||
      m.service_group?.toLowerCase().includes(q) ||
      m.goods_group?.toLowerCase().includes(q)
    )
  }, [matches, search])

  async function addMatch() {
    if (!addingService.trim() || !addingGoods.trim()) return
    setAdding(true)
    try {
      await fetch('/api/good-service-matches', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ good_name: addingGoods, service_name: addingService }),
      })
      setAddingService('')
      setAddingGoods('')
      await load()
    } catch (e) {
      console.error('Error adding match:', e)
    }
    setAdding(false)
  }

  async function removeMatch(matchId: number) {
    if (!confirm('Remove this match?')) return
    setDeletingId(matchId)
    try {
      await fetch(`/api/good-service-matches/${matchId}`, { method: 'DELETE' })
      await load()
    } catch (e) {
      console.error('Error removing match:', e)
    }
    setDeletingId(null)
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const serviceOptions = allServices.filter(s => !matches.some(m => m.service_name === s.name))
  const goodsOptions = allGoods.filter(g => !matches.some(m => m.goods_name === g.name))

  return (
    <div className="flex flex-col h-full gap-4 p-4">
      {/* Add new match form */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 shrink-0">
        <p className="text-xs font-semibold text-blue-900 mb-2">Add New Match</p>
        <div className="flex gap-2 items-end">
          <div className="flex-1">
            <label className="text-[9px] font-semibold text-gray-600 block mb-1">Service</label>
            <select value={addingService} onChange={e => setAddingService(e.target.value)}
              className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Select a service…</option>
              {serviceOptions.map(s => (
                <option key={s.name} value={s.name}>
                  {s.name} {s.group ? `(${s.group})` : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="flex-1">
            <label className="text-[9px] font-semibold text-gray-600 block mb-1">Goods</label>
            <select value={addingGoods} onChange={e => setAddingGoods(e.target.value)}
              className="w-full text-xs bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
              <option value="">Select goods…</option>
              {goodsOptions.map(g => (
                <option key={g.name} value={g.name}>
                  {g.name} {g.group ? `(${g.group})` : ''}
                </option>
              ))}
            </select>
          </div>
          <button onClick={addMatch} disabled={adding || !addingService || !addingGoods}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 transition disabled:opacity-40">
            {adding ? 'Adding…' : 'Add'}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="shrink-0">
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Search service or goods name…"
          className="w-full text-xs bg-gray-50 border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400" />
        <p className="text-[9px] text-gray-400 mt-1">{filtered.length} of {matches.length} matches</p>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto min-h-0">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">
            {matches.length === 0 ? 'No matches yet. Add one above.' : 'No matches match your search.'}
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead className="sticky top-0 bg-gray-100 z-10">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Service</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Service Group</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Goods</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-600 border-b border-gray-300">Goods Group</th>
                <th className="text-center px-3 py-2 font-semibold text-gray-600 border-b border-gray-300 w-10">Action</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id} className="border-b border-gray-200 hover:bg-gray-50">
                  <td className="px-3 py-2 text-gray-900 font-medium">{m.service_name}</td>
                  <td className="px-3 py-2 text-gray-600">{m.service_group || '—'}</td>
                  <td className="px-3 py-2 text-gray-900 font-medium">{m.goods_name}</td>
                  <td className="px-3 py-2 text-gray-600">{m.goods_group || '—'}</td>
                  <td className="px-3 py-2 text-center">
                    <button onClick={() => removeMatch(m.id)} disabled={deletingId === m.id}
                      className="text-red-500 hover:text-red-700 font-bold text-sm transition disabled:opacity-40">
                      {deletingId === m.id ? '…' : '×'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
