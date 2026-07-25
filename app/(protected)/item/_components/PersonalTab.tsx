'use client'
import { useState, useEffect, useMemo } from 'react'

export type PersonalEntry = {
  id: number
  entry_date: string
  description: string
  amount: string
  direction: 'in' | 'out'
  category: string | null
  subcategory: string | null
  notes: string | null
  needs_review: boolean
}
type Entry = PersonalEntry

export const CATEGORIES = ['Children', 'Building', 'Car', 'Health', 'Mama/Family', 'Household', 'Other']

// Children is the only category with a fixed set of subcategories so far --
// one per kid, so an entry can say which of them it's actually for.
export const CHILDREN_SUBCATEGORIES = ['Percy', 'Prisley', 'Preston', 'Princess']

export const CAT_ICON: Record<string, string> = {
  Children:     '👶',
  Building:     '🏗️',
  Car:          '🚗',
  Health:       '💊',
  'Mama/Family':'👨‍👩‍👧',
  Household:    '🏠',
  Other:        '📋',
}

export const CAT_COLOR: Record<string, string> = {
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

const TH = 'text-left px-3 py-2 font-bold text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-200'
const TD = 'px-3 py-2'

// Shared between the standalone /personal page and CAB's embedded Personal
// panel -- embedded hides the page-level heading, since the host tab
// already provides its own context/back-navigation.
export default function PersonalTab({ embedded = false }: { embedded?: boolean } = {}) {
  const [entries, setEntries]   = useState<Entry[]>([])
  const [loading, setLoading]   = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [view, setView]         = useState<'breakdown' | 'list'>('breakdown')
  const [catFilter, setCatFilter] = useState<string>('All')
  const [search, setSearch]     = useState('')
  const [editId, setEditId]     = useState<number | null>(null)
  const [editCat, setEditCat]   = useState('')
  const [editCatCustom, setEditCatCustom] = useState(false)
  const [editSubcat, setEditSubcat] = useState('')
  const [showAdd, setShowAdd]   = useState(false)

  // New entry form
  const [newDate, setNewDate]   = useState('')
  const [newDesc, setNewDesc]   = useState('')
  const [newAmt, setNewAmt]     = useState('')
  const [newDir, setNewDir]     = useState<'out' | 'in'>('out')
  const [newCat, setNewCat]     = useState('Other')
  const [newCatCustom, setNewCatCustom] = useState(false)
  const [newSubcat, setNewSubcat] = useState('')
  const [newNotes, setNewNotes] = useState('')
  const [saving, setSaving]     = useState(false)

  useEffect(() => {
    fetch('/api/personal')
      .then(r => { if (r.status === 403) { setForbidden(true); return [] } return r.json() })
      .then(d => { setEntries(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  // Fixed CATEGORIES plus any custom category already in use, so a
  // category someone typed in via "+ Add new category…" stays selectable
  // (for new entries and re-editing) instead of only existing on the one
  // entry it was first typed on.
  const allCategories = useMemo(() => {
    const custom = entries.map(e => e.category).filter((c): c is string => !!c && !CATEGORIES.includes(c))
    return [...CATEGORIES, ...Array.from(new Set(custom)).sort()]
  }, [entries])

  const breakdown = useMemo(() => {
    const out = entries.filter(e => e.direction === 'out')
    const map: Record<string, { count: number; total: number }> = {}
    for (const cat of allCategories) map[cat] = { count: 0, total: 0 }
    for (const e of out) {
      const cat = e.category && allCategories.includes(e.category) ? e.category : 'Other'
      map[cat].count++
      map[cat].total += parseFloat(e.amount)
    }
    return allCategories.map(cat => ({ cat, ...map[cat] })).sort((a, b) => b.total - a.total)
  }, [entries, allCategories])

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
    const subcategory = editCat === 'Children' ? (editSubcat || null) : null
    await fetch('/api/personal', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, category: editCat, subcategory }) })
    setEntries(prev => prev.map(e => e.id === id ? { ...e, category: editCat, subcategory } : e))
    setEditId(null)
    setEditCatCustom(false)
  }

  async function addEntry() {
    if (!newDate || !newDesc || !newAmt) return
    setSaving(true)
    const subcategory = newCat === 'Children' ? (newSubcat || null) : null
    const res = await fetch('/api/personal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ entry_date: newDate, description: newDesc, amount: parseFloat(newAmt), direction: newDir, category: newCat, subcategory, notes: newNotes || null }),
    })
    const data = await res.json()
    if (data.id) {
      setEntries(prev => [{ id: data.id, entry_date: newDate, description: newDesc, amount: newAmt, direction: newDir, category: newCat, subcategory, notes: newNotes || null, needs_review: false }, ...prev])
      setShowAdd(false); setNewDate(''); setNewDesc(''); setNewAmt(''); setNewDir('out'); setNewCat('Other'); setNewCatCustom(false); setNewSubcat(''); setNewNotes('')
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
    <div className={embedded ? 'space-y-4' : 'space-y-4 pb-10'}>
      {/* Header */}
      <div className="flex items-center justify-between">
        {embedded ? <div /> : (
          <div>
            <h1 className="text-lg font-bold text-gray-900">Personal</h1>
            <p className="text-[10px] text-gray-400">Private · Grony & Joe only</p>
          </div>
        )}
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
            {newCatCustom ? (
              <div className="col-span-2 flex gap-2">
                <input value={newCat} onChange={e => setNewCat(e.target.value)} placeholder="New category name" autoFocus
                  className="flex-1 border border-blue-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400" />
                <button type="button" onClick={() => { setNewCatCustom(false); setNewCat('Other') }}
                  className="text-xs text-gray-500 underline whitespace-nowrap">Choose existing</button>
              </div>
            ) : (
              <select value={newCat} onChange={e => {
                  if (e.target.value === '__new__') { setNewCatCustom(true); setNewCat('') } else setNewCat(e.target.value)
                  setNewSubcat('')
                }}
                className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                <option value="__new__">+ Add new category…</option>
              </select>
            )}
            {newCat === 'Children' && !newCatCustom && (
              <select value={newSubcat} onChange={e => setNewSubcat(e.target.value)}
                className="col-span-2 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400">
                <option value="">Which child? (optional)</option>
                {CHILDREN_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            )}
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
                    <span className="text-lg">{CAT_ICON[cat] ?? '🏷️'}</span>
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
            {['All', ...allCategories].map(f => (
              <button key={f} onClick={() => setCatFilter(f)}
                className={`shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold transition
                  ${catFilter === f ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {f === 'All' ? 'All' : `${CAT_ICON[f] ?? '🏷️'} ${f}`}
              </button>
            ))}
          </div>

          {/* Search */}
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search entries…"
            className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400" />

          {/* Category total */}
          {catFilter !== 'All' && (
            <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-xl px-3 py-2">
              <span className="text-xs font-semibold text-gray-600">{CAT_ICON[catFilter] ?? '🏷️'} {catFilter} total</span>
              <span className="text-sm font-bold text-gray-900">{c(filtered.filter(e=>e.direction==='out').reduce((s,e)=>s+parseFloat(e.amount),0))}</span>
            </div>
          )}

          {filtered.length === 0 && <p className="py-10 text-center text-gray-400 text-sm">No entries found.</p>}

          {filtered.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    <th className={`${TH} whitespace-nowrap`}>Date</th>
                    <th className={TH}>Item</th>
                    <th className={`${TH} text-right`}>Amount</th>
                    <th className={TH}>Category</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filtered.map((e, i) => (
                    <tr key={e.id} className={i % 2 === 1 ? 'bg-gray-50' : 'bg-white'}>
                      <td className={`${TD} text-gray-500 whitespace-nowrap align-top`}>{fmtDate(e.entry_date)}</td>
                      <td className={`${TD} text-gray-800 align-top`}>
                        {e.description}
                        {e.notes && <p className="text-[10px] text-gray-400 mt-0.5">{e.notes}</p>}
                      </td>
                      <td className={`${TD} text-right font-bold align-top whitespace-nowrap ${e.direction === 'in' ? 'text-green-700' : 'text-red-600'}`}>
                        {e.direction === 'in' ? '+' : '-'}{c(e.amount)}
                      </td>
                      <td className={`${TD} align-top`}>
                        {editId === e.id ? (
                          editCatCustom ? (
                            <div className="flex items-center gap-1">
                              <input value={editCat} onChange={ev => setEditCat(ev.target.value)} placeholder="New category name" autoFocus
                                className="border border-blue-300 rounded-lg px-2 py-1 text-[10px] outline-none" />
                              <button onClick={() => saveCategory(e.id)} className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded-lg font-semibold">Save</button>
                              <button onClick={() => { setEditId(null); setEditCatCustom(false) }} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">✕</button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 flex-wrap">
                              <select value={editCat} onChange={ev => {
                                  if (ev.target.value === '__new__') { setEditCatCustom(true); setEditCat('') } else setEditCat(ev.target.value)
                                  setEditSubcat('')
                                }}
                                className="border border-blue-300 rounded-lg px-2 py-1 text-[10px] outline-none">
                                {allCategories.map(c => <option key={c} value={c}>{c}</option>)}
                                <option value="__new__">+ Add new category…</option>
                              </select>
                              {editCat === 'Children' && (
                                <select value={editSubcat} onChange={ev => setEditSubcat(ev.target.value)}
                                  className="border border-blue-300 rounded-lg px-2 py-1 text-[10px] outline-none">
                                  <option value="">Which child?</option>
                                  {CHILDREN_SUBCATEGORIES.map(s => <option key={s} value={s}>{s}</option>)}
                                </select>
                              )}
                              <button onClick={() => saveCategory(e.id)} className="text-[10px] px-2 py-1 bg-blue-600 text-white rounded-lg font-semibold">Save</button>
                              <button onClick={() => setEditId(null)} className="text-[10px] px-2 py-1 bg-gray-100 text-gray-600 rounded-lg">✕</button>
                            </div>
                          )
                        ) : (
                          <button onClick={() => { setEditId(e.id); setEditCat(e.category ?? 'Other'); setEditCatCustom(false); setEditSubcat(e.subcategory ?? '') }}
                            className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${CAT_COLOR[e.category ?? 'Other'] ?? CAT_COLOR['Other']}`}>
                            {CAT_ICON[e.category ?? 'Other'] ?? '🏷️'} {e.category ?? 'Other'}{e.subcategory ? ` · ${e.subcategory}` : ''} ✎
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
