'use client'
import { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'

type Entry = {
  id: number
  entry_date: string
  description: string
  amount: string
  direction: 'in' | 'out'
  category: string | null
  notes: string | null
  needs_review: boolean
}

const CATEGORIES = ['Children', 'Building', 'Car', 'Health', 'Mama/Family', 'Household', 'Other']

const CAT_ICON: Record<string, string> = {
  Children:     '👶',
  Building:     '🏗️',
  Car:          '🚗',
  Health:       '💊',
  'Mama/Family':'👨‍👩‍👧',
  Household:    '🏠',
  Other:        '📋',
}

const CAT_COLOR: Record<string, string> = {
  Children:     'bg-blue-100 text-blue-700',
  Building:     'bg-amber-100 text-amber-700',
  Car:          'bg-slate-100 text-slate-700',
  Health:       'bg-red-100 text-red-600',
  'Mama/Family':'bg-purple-100 text-purple-700',
  Household:    'bg-green-100 text-green-700',
  Other:        'bg-gray-100 text-gray-500',
}

function c(v: string | number | null | undefined) {
  const n = parseFloat(String(v ?? '0'))
  return isNaN(n) ? '—' : `₵${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export default function PersonalPage() {
  const router = useRouter()
  const [entries, setEntries]   = useState<Entry[]>([])
  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [view, setView]         = useState<'breakdown' | 'list'>('breakdown')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [search, setSearch]     = useState('')
  const [editId, setEditId]     = useState<number | null>(null)
  const [editCat, setEditCat]   = useState('')
  const [showAdd, setShowAdd]   = useState(false)

  // New entry form
  const [newDate, setNewDate]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newAmt, setNewAmt]     = useState('')
  const [newDir, setNewDir]     = useState<'out' | 'in'>('out')
  const [newCat, setNewCat]     = useState('Other')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    fetch('/api/personal')
      .then(r => { if (r.status === 403) { setForbidden(true); return [] } return r.json() })
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const breakdown = useMemo(() => {
    const out = entries.filter(e => e.direction === 'out')
    const map: Record<string, { count: number; total: number }> = {}
    for (const cat of CATEGORIES) map[cat] = { count: 0, total: 0 }
    for (const e of out) {
      const cat = e.category && CATEGORIES.includes(e.category) ? e.category : 'Other'
      map[cat].count++
      map[cat].total += parseFloat(e.amount)
    }
    return CATEGORIES.map(cat => ({ cat, ...map[cat] })).sort((a, b) => b.total - a.total)
  }, [entries])

  const grandOut = useMemo(() => entries.filter(e => e.direction === 'out').reduce((s, e) => s + parseFloat(e.amount), 0), [entries])
  const grandIn  = useMemo(() => entries.filter(e => e.direction === 'in').reduce((s, e)  => s + parseFloat(e.amount), 0), [entries])

  const filtered = useMemo(() => {
    let v = entries
    if (catFilter !== 'All') v = v.filter(e => (e.category ?? 'Other') === catFilter)
    if (search.trim()) {
      const q = search.toLowerCase()
      v = v.filter(e => e.description.toLowerCase().includes(q) || (e.notes ?? '').toLowerCase().includes(q))
    }
    return v
  }, [entries, catFilter, search])

  async function saveCategory(id: number) {
    await fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, category: editCat }) })
    setEntries(prev => prev.map(e => e.id === id ? { ...e, category: editCat } : e))
    setEditId(null)
  }

  async function addEntry() {
    if (!newDate || !newDesc || !newAmt) return
    setSaving(true)
    const res = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: newDate, description: newDesc, amount: parseFloat(newAmt), direction: newDir, category: newCat, notes: newNotes || null }),
    })
    const data = await res.json()
    if (data.id) {
      setEntries(prev => [{ id: data.id, entry_date: newDate, description: newDesc, amount: newAmt, direction: newDir, category: newCat, notes: newNotes || null, needs_review: false }, ...prev])
      setShowAdd(false); setNewDate(''); setNewDesc(''); setNewAmt(''); setNewDir('out'); setNewCat('Other'); setNewNotes('')
    }
    setSaving(false)
  }

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>
  if (forbidden) return (
    <div className="py-20 text-center space-y-2">
      <p className="text-2xl">🔒</p>
      <p className="text-gray-500 text-sm">This page is private.</p>
    </div>
  )

  return (
    <div className="space-y-4 pb-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Personal</h1>
          <p className="text-[10px] text-gray-400">Private · Grony & Joe only</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded-lg">
          + Add
        </button>
      </div>

      {/* Add entry form */}
      {showAdd && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 space-y-3">
          <p className="text-sm font-semibold text-gray-700">New Entry</p>
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
              className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            <textarea value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Description"
              className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400 resize-none" rows={2} />
            <input type="number" value={newAmt} onChange={e => setNewAmt(e.target.value)} placeholder="Amount (₵)"
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
            <select value={newDir} onChange={e => setNewDir(e.target.value as 'in' | 'out')}
              className="border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
              <option value="out">Out (expense)</option>
              <option value="in">In (received)</option>
            </select>
            <select value={newCat} onChange={e => setNewCat(e.target.value)}
              className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <input value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Notes (optional)"
              className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
          </div>
          <div className="flex gap-2">
            <button onClick={addEntry} disabled={saving || !newDate || !newDesc || !newAmt}
              className="flex-1 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg disabled:opacity-40">
              {saving ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => setShowAdd(false)}
              className="px-4 py-2 bg-gray-100 text-gray-600 text-sm rounded-lg">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Totals */}
      <div className="grid grid-cols-3 gap-2">
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Total Spent</p>
          <p className="text-sm font-bold text-red-600">{c(grandOut)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Received</p>
          <p className="text-sm font-bold text-green-700">{c(grandIn)}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5">
          <p className="text-[10px] text-gray-400">Entries</p>
          <p className="text-sm font-bold text-gray-900">{entries.length}</p>
        </div>
      </div>

      {/* View toggle */}
      <div className="flex gap-1.5">
        {(['breakdown', 'list'] as const).map(v => (
          <button key={v} onClick={() => setView(v)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition
              ${view === v ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {v === 'breakdown' ? 'By Category' : 'All Entries'}
          </button>
        ))}
      </div>

      {/* BREAKDOWN VIEW */}
      {view === 'breakdown' && (
        <div className="space-y-2">
          {breakdown.map(({ cat, count, total }) => {
            const pct = grandOut > 0 ? (total / grandOut) * 100 : 0
            return (
              <button key={cat} onClick={() => { setView('list'); setCatFilter(cat) }}
                className="w-full text-left bg-white border border-gray-200 rounded-xl p-3 hover:border-gray-300 transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{CAT_ICON[cat]}</span>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{cat}</p>
                      <p className="text-[10px] text-gray-400">{count} entr{count !== 1 ? 'ies' : 'y'}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-gray-900">{c(total)}</p>
                    <p className="text-[10px] text-gray-400">{pct.toFixed(1)}%</p>
                  </div>
                </div>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </button>
            )
          })}
        </div>
      )}

      {/* LIST VIEW */}
      {view === 'list' && (
        <div className="space-y-3">
          {/* Category chips */}
          <div className="flex gap-1.5 overflow-x-auto pb-0.5">
            {['All', ...CATEGORIES].map(f => (
              <button key={f} onClick={() => setCatFilter(f)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${catFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'All' ? 'All' : `${CAT_ICON[f]} ${f}`}
              </button>
            ))}
          </div>

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…"
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />

          {/* Category total */}
          {catFilter !== 'All' && (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-gray-600">{CAT_ICON[catFilter]} {catFilter} total</span>
              <span className="text-sm font-bold text-gray-900">{c(filtered.filter(e=>e.direction==='out').reduce((s,e)=>s+parseFloat(e.amount),0))}</span>
            </div>
          )}

          {filtered.length === 0 && <p className="py-10 text-center text-gray-400 text-sm">No entries found.</p>}

          {filtered.map(e => (
            <div key={e.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500">{fmtDate(e.entry_date)}</p>
                  <p className="text-sm text-gray-800 leading-snug">{e.description}</p>
                  {e.notes && <p className="text-xs text-gray-400 mt-0.5">{e.notes}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-sm font-bold ${e.direction === 'in' ? 'text-green-700' : 'text-red-600'}`}>
                    {e.direction === 'in' ? '+' : '-'}{c(e.amount)}
                  </p>
                </div>
              </div>

              {/* Category tag + edit */}
              <div className="flex items-center gap-2">
                {editId === e.id ? (
                  <>
                    <select value={editCat} onChange={ev => setEditCat(ev.target.value)}
                      className="flex-1 border border-blue-300 rounded-lg px-2 py-1 text-xs outline-none">
                      {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <button onClick={() => saveCategory(e.id)} className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded-lg font-semibold">Save</button>
                    <button onClick={() => setEditId(null)} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">✕</button>
                  </>
                ) : (
                  <button onClick={() => { setEditId(e.id); setEditCat(e.category ?? 'Other') }}
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CAT_COLOR[e.category ?? 'Other'] ?? CAT_COLOR['Other']}`}>
                    {CAT_ICON[e.category ?? 'Other']} {e.category ?? 'Other'} ✎
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
