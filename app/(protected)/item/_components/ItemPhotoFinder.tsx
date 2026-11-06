'use client'
import { useEffect, useMemo, useState } from 'react'

type Row = { id: number; name: string; group: string | null; image_url: string | null; image_credit: string | null; suggest: string }
type Match = { title: string; thumb: string; full: string; page: string; licence: string; author: string; width: number; height: number }

// Advert > Item Photos: find a free-licence photo on Wikimedia Commons for items that have none, by the item's
// name. Nothing is attached until a member of staff looks at a match and taps "Use this photo" (the approval).
// The credit (author, licence, source) is saved with the photo. Own photos are added on the item's own panel.
export default function ItemPhotoFinder() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  const [group, setGroup] = useState('')
  const [filter, setFilter] = useState('')
  const [missingOnly, setMissingOnly] = useState(true)
  const [open, setOpen] = useState<number | null>(null)
  const [q, setQ] = useState('')
  const [res, setRes] = useState<{ query: string; matches: Match[] } | null>(null)
  const [searching, setSearching] = useState(false)
  const [pick, setPick] = useState<Match | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetch('/api/items/photo-finder').then(r => r.json()).then(d => { if (Array.isArray(d)) setRows(d); else setErr(d?.error ?? 'Could not load items') }).catch(() => setErr('Could not load items'))
  }, [])
  const groups = useMemo(() => [...new Set((rows ?? []).map(r => r.group ?? '(no group)'))], [rows])
  const shown = useMemo(() => (rows ?? []).filter(r =>
    (!missingOnly || !r.image_url) && (!group || (r.group ?? '(no group)') === group) && (!filter || r.name.toLowerCase().includes(filter.toLowerCase()))), [rows, missingOnly, group, filter])
  const done = (rows ?? []).filter(r => r.image_url).length

  async function search(words: string, grp?: string | null) {
    setSearching(true); setRes(null); setPick(null); setErr('')
    try {
      const r = await fetch(`/api/items/photo-finder?q=${encodeURIComponent(words)}&group=${encodeURIComponent(grp ?? '')}`); const d = await r.json()
      if (!r.ok) throw new Error(d?.error ?? 'Search failed')
      setRes(d)
    } catch (e) { setErr((e as Error).message) }
    setSearching(false)
  }
  function openRow(r: Row) {
    if (open === r.id) { setOpen(null); return }
    setOpen(r.id); setQ(r.suggest); void search(r.suggest, r.group)
  }
  async function use(r: Row, m: Match) {
    setSaving(true); setErr('')
    try {
      const x = await fetch(`/api/items/${r.id}/picture/web`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: m.full, page: m.page, licence: m.licence, author: m.author }) })
      const d = await x.json().catch(() => ({}))
      if (!x.ok) throw new Error(d.error ?? 'Could not attach the photo')
      setRows(rs => (rs ?? []).map(y => y.id === r.id ? { ...y, image_url: d.image_url, image_credit: d.image_credit } : y))
      setOpen(null); setPick(null); setRes(null)
    } catch (e) { setErr((e as Error).message) }
    setSaving(false)
  }

  if (!rows) return <p className="p-3 text-xs text-gray-500">{err || 'Loading items…'}</p>
  return (
    <div className="space-y-2 p-2 pb-6">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-2 text-[11px] text-amber-900">
        <p className="font-bold">Free photos from Wikimedia Commons</p>
        <p>Only photos we are allowed to use in adverts are shown, and the author&apos;s name is saved with each one. <b>Check that the photo really shows our item</b> (same type, same plug, same size) before tapping <b>Use this photo</b>. A photo of our own stock is always better: add it on the item&apos;s own panel.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="font-semibold text-gray-700">{done} of {rows.length} items have a photo</span>
        <label className="flex items-center gap-1"><input type="checkbox" checked={missingOnly} onChange={e => setMissingOnly(e.target.checked)} /> Without photo only</label>
        <select value={group} onChange={e => setGroup(e.target.value)} className="rounded border border-gray-300 px-1 py-0.5">
          <option value="">All groups</option>{groups.map(g => <option key={g}>{g}</option>)}
        </select>
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Find item…" className="w-36 rounded border border-gray-300 px-1.5 py-0.5" />
      </div>
      {err && <p className="text-xs text-red-600">{err}</p>}
      <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 bg-white">
        {shown.slice(0, 200).map(r => (
          <div key={r.id}>
            <button type="button" onClick={() => openRow(r)} className="flex w-full items-center gap-2 px-2 py-1.5 text-left">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded border border-gray-200 bg-gray-50 text-[8px] text-gray-400">
                {r.image_url ? <img src={r.image_url} alt="" className="h-full w-full object-cover" /> : 'none'}
              </span>
              <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-gray-900">{r.name}</span><span className="block text-[10px] text-gray-500">{r.group ?? 'No group'}</span></span>
              <span className="shrink-0 text-[10px] font-bold text-blue-600">{open === r.id ? 'Close' : r.image_url ? 'Replace' : 'Find photos'}</span>
            </button>
            {open === r.id && (
              <div className="space-y-2 bg-gray-50 p-2">
                <form onSubmit={e => { e.preventDefault(); void search(q, r.group) }} className="flex gap-1.5">
                  <input value={q} onChange={e => setQ(e.target.value)} className="min-w-0 flex-1 rounded border border-gray-300 px-1.5 py-1 text-xs" />
                  <button className="rounded bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white" disabled={searching}>{searching ? 'Searching…' : 'Search'}</button>
                </form>
                <p className="text-[10px] text-gray-500">Not the right photos? Change the words (e.g. &quot;HDMI cable&quot;, &quot;HP laptop charger&quot;) and search again.</p>
                {res && res.matches.length === 0 && <p className="text-xs text-gray-600">No free photos found for &quot;{res.query}&quot;. Try shorter or more general words.</p>}
                {res && res.matches.length > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                    {res.matches.map(m => (
                      <button key={m.full} type="button" onClick={() => setPick(m)} className={`overflow-hidden rounded border-2 bg-white text-left ${pick?.full === m.full ? 'border-blue-600' : 'border-transparent'}`}>
                        <img src={m.thumb} alt={m.title} loading="lazy" className="aspect-square w-full object-cover" />
                        <span className="block truncate px-1 text-[9px] text-gray-600">{m.licence}</span>
                      </button>
                    ))}
                  </div>
                )}
                {pick && (
                  <div className="space-y-1.5 rounded border border-blue-200 bg-white p-2">
                    <img src={pick.full} alt={pick.title} className="max-h-72 w-full rounded object-contain" />
                    <p className="text-[10px] text-gray-600"><b>{pick.title}</b> · by {pick.author} · {pick.licence} · <a href={pick.page} target="_blank" rel="noreferrer" className="text-blue-600 underline">source</a></p>
                    <div className="flex gap-1.5">
                      <button type="button" disabled={saving} onClick={() => void use(r, pick)} className="rounded bg-green-600 px-3 py-1 text-[11px] font-bold text-white disabled:opacity-40">{saving ? 'Attaching…' : 'Use this photo'}</button>
                      <button type="button" onClick={() => setPick(null)} className="rounded bg-gray-100 px-3 py-1 text-[11px] font-bold text-gray-700">Not this one</button>
                    </div>
                  </div>
                )}
                {r.image_credit && <p className="text-[10px] text-gray-500">Current photo: {r.image_credit}</p>}
              </div>
            )}
          </div>
        ))}
        {shown.length === 0 && <p className="p-3 text-xs text-gray-500">Nothing to show. Untick &quot;Without photo only&quot; to see all items.</p>}
      </div>
      {shown.length > 200 && <p className="text-[10px] text-gray-500">Showing the first 200. Pick a group to see the rest.</p>}
    </div>
  )
}
