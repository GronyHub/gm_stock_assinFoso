'use client'
import { useEffect, useState } from 'react'

// Multi-select for a customer's Service/Goods. Options are the item groups
// (Inks, Printing Press, ...). The value is stored as a comma-separated
// string so the existing service_goods column and search keep working.
const split = (v: string) => v.split(',').map(s => s.trim()).filter(Boolean)

export default function ServiceGoodsPicker({ value, onChange, labelCls }: { value: string; onChange: (v: string) => void; labelCls: string }) {
  const [groups, setGroups] = useState<string[]>([])
  const [other, setOther] = useState('')
  const chosen = split(value)

  useEffect(() => {
    fetch('/api/items/groups').then(r => r.ok ? r.json() : []).then(d => {
      setGroups(Array.isArray(d) ? d.filter((g: unknown): g is string => typeof g === 'string' && g.trim() !== '') : [])
    }).catch(() => {})
  }, [])

  const toggle = (g: string) => {
    const has = chosen.some(c => c.toLowerCase() === g.toLowerCase())
    onChange((has ? chosen.filter(c => c.toLowerCase() !== g.toLowerCase()) : [...chosen, g]).join(', '))
  }
  const addOther = () => {
    const t = other.trim()
    if (!t) return
    if (!chosen.some(c => c.toLowerCase() === t.toLowerCase())) onChange([...chosen, t].join(', '))
    setOther('')
  }
  // Anything already saved that is not an item group (older free-text entries).
  const extras = chosen.filter(c => !groups.some(g => g.toLowerCase() === c.toLowerCase()))
  const all = [...groups, ...extras]

  return (
    <div>
      <label className={labelCls}>Service/Goods <span className="normal-case font-normal">(tap to select more than one)</span></label>
      <div className="flex flex-wrap gap-1.5">
        {all.map(g => {
          const on = chosen.some(c => c.toLowerCase() === g.toLowerCase())
          return (
            <button key={g} type="button" onClick={() => toggle(g)}
              className={`px-2.5 py-1 rounded-full text-xs font-semibold border transition ${on ? 'bg-blue-600 border-blue-600 text-white' : 'bg-gray-100 border-gray-200 text-gray-700 hover:bg-gray-200'}`}>
              {g}
            </button>
          )
        })}
        {all.length === 0 && <span className="text-xs text-gray-400">Loading…</span>}
      </div>
      <div className="flex gap-2 mt-1.5">
        <input value={other} onChange={e => setOther(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addOther() } }}
          placeholder="Other (type and press Add)"
          className="flex-1 bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400" />
        <button type="button" onClick={addOther} disabled={!other.trim()}
          className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs font-semibold rounded-lg transition">Add</button>
      </div>
    </div>
  )
}
