'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

const PEOPLE = ['Grony', 'Mina', 'Prisca'] as const
type Person = typeof PEOPLE[number]

type Submenu = { id: number; person: string; name: string; sort_order: number; created_at: string }
type Column = { id: number; submenu_id: number; name: string; sort_order: number; created_at: string }
type Row = { id: number; submenu_id: number; sort_order: number; created_at: string; values: Record<number, string> }

const chipCls = (active: boolean) =>
  `text-xs font-semibold px-3 py-1.5 rounded-lg transition
   ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`

// A generic "define your own submenus, then define your own columns under
// each one" builder -- Grony/Mina/Prisca each get their own independent set
// of submenus. Once a submenu has columns, rows of actual data can be added
// underneath them, each cell saved independently on blur.
export default function UKTab() {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()

  const [person, setPerson] = useState<Person>('Grony')
  const [submenus, setSubmenus] = useState<Submenu[]>([])
  const [selectedSubmenuId, setSelectedSubmenuId] = useState<number | null>(null)
  const [columns, setColumns] = useState<Column[]>([])
  const [rows, setRows] = useState<Row[]>([])

  const [newSubmenuName, setNewSubmenuName] = useState('')
  const [showAddSubmenu, setShowAddSubmenu] = useState(false)
  const [editingSubmenuId, setEditingSubmenuId] = useState<number | null>(null)
  const [editSubmenuName, setEditSubmenuName] = useState('')

  const [newColumnName, setNewColumnName] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null)
  const [editColumnName, setEditColumnName] = useState('')

  function loadSubmenus(p: Person) {
    fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSubmenus(Array.isArray(d) ? d : []))
      .catch(() => {})
  }
  useEffect(() => {
    if (username !== 'grony') return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedSubmenuId(null)
    loadSubmenus(person)
  }, [person, username])

  function loadColumns(submenuId: number) {
    fetch(`/api/uk/columns?submenu_id=${submenuId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setColumns(Array.isArray(d) ? d : []))
      .catch(() => {})
  }
  useEffect(() => {
    if (selectedSubmenuId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColumns([])
      return
    }
    loadColumns(selectedSubmenuId)
  }, [selectedSubmenuId])

  function loadRows(submenuId: number) {
    fetch(`/api/uk/rows?submenu_id=${submenuId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setRows(Array.isArray(d) ? d : []))
      .catch(() => {})
  }
  useEffect(() => {
    if (selectedSubmenuId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([])
      return
    }
    loadRows(selectedSubmenuId)
  }, [selectedSubmenuId])

  async function addSubmenu() {
    const name = newSubmenuName.trim()
    if (!name) return
    const res = await fetch('/api/uk/submenus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person, name }),
    })
    if (res.ok) { setNewSubmenuName(''); setShowAddSubmenu(false); loadSubmenus(person) }
  }
  async function saveSubmenuName(id: number) {
    const name = editSubmenuName.trim()
    if (!name) return
    setSubmenus(prev => prev.map(s => s.id === id ? { ...s, name } : s))
    setEditingSubmenuId(null)
    await fetch(`/api/uk/submenus/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {})
  }
  async function deleteSubmenu(id: number) {
    setSubmenus(prev => prev.filter(s => s.id !== id))
    if (selectedSubmenuId === id) setSelectedSubmenuId(null)
    await fetch(`/api/uk/submenus/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function addColumn() {
    if (selectedSubmenuId == null) return
    const name = newColumnName.trim()
    if (!name) return
    const res = await fetch('/api/uk/columns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submenu_id: selectedSubmenuId, name }),
    })
    if (res.ok) { setNewColumnName(''); setShowAddColumn(false); loadColumns(selectedSubmenuId) }
  }
  async function saveColumnName(id: number) {
    const name = editColumnName.trim()
    if (!name) return
    setColumns(prev => prev.map(c => c.id === id ? { ...c, name } : c))
    setEditingColumnId(null)
    await fetch(`/api/uk/columns/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).catch(() => {})
  }
  async function deleteColumn(id: number) {
    setColumns(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/uk/columns/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  async function addRow() {
    if (selectedSubmenuId == null) return
    const res = await fetch('/api/uk/rows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submenu_id: selectedSubmenuId, values: {} }),
    })
    if (res.ok) { const row = await res.json(); setRows(prev => [...prev, row]) }
  }
  function editCell(rowId: number, columnId: number, value: string) {
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, values: { ...r.values, [columnId]: value } } : r))
  }
  async function saveCell(rowId: number, columnId: number, value: string) {
    await fetch(`/api/uk/rows/${rowId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { [columnId]: value } }),
    }).catch(() => {})
  }
  async function deleteRow(id: number) {
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/uk/rows/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  if (username !== 'grony') {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 text-sm">This page is private.</p>
      </div>
    )
  }

  const selectedSubmenu = submenus.find(s => s.id === selectedSubmenuId) ?? null

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-900">UK</h1>
        <p className="text-[10px] text-gray-400">Private · Grony only</p>
      </div>

      <div className="flex gap-1.5">
        {PEOPLE.map(p => (
          <button key={p} onClick={() => setPerson(p)} className={chipCls(person === p)}>{p}</button>
        ))}
      </div>

      {/* Submenus for the selected person */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Submenus</p>
        <div className="flex flex-wrap gap-1.5">
          {submenus.map(s => (
            <div key={s.id} className="flex items-center gap-1 bg-gray-100 rounded-lg pr-1">
              {editingSubmenuId === s.id ? (
                <input autoFocus value={editSubmenuName} onChange={e => setEditSubmenuName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && saveSubmenuName(s.id)}
                  className="text-xs bg-white border border-blue-300 rounded px-2 py-1 outline-none w-28" />
              ) : (
                <button onClick={() => setSelectedSubmenuId(s.id)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition ${selectedSubmenuId === s.id ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-200'}`}>
                  {s.name}
                </button>
              )}
              {editingSubmenuId === s.id ? (
                <button onClick={() => saveSubmenuName(s.id)} className="text-[10px] font-semibold text-blue-600 px-1">Save</button>
              ) : (
                <button onClick={() => { setEditingSubmenuId(s.id); setEditSubmenuName(s.name) }} className="text-gray-400 hover:text-gray-600 px-0.5" title="Rename">✎</button>
              )}
              <button onClick={() => deleteSubmenu(s.id)} className="text-gray-300 hover:text-red-500 px-0.5" title="Delete submenu">×</button>
            </div>
          ))}
          {showAddSubmenu ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={newSubmenuName} onChange={e => setNewSubmenuName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addSubmenu()}
                placeholder="Submenu name" className="text-xs bg-white border border-blue-300 rounded-lg px-2 py-1.5 outline-none w-32" />
              <button onClick={addSubmenu} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-blue-600 text-white">Add</button>
              <button onClick={() => { setShowAddSubmenu(false); setNewSubmenuName('') }} className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500">✕</button>
            </div>
          ) : (
            <button onClick={() => setShowAddSubmenu(true)} className={chipCls(false)}>+ New Submenu</button>
          )}
        </div>
      </div>

      {/* Columns for the selected submenu */}
      {selectedSubmenu && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Columns · {selectedSubmenu.name}</p>
          <div className="flex flex-wrap gap-1.5">
            {columns.map(c => (
              <div key={c.id} className="flex items-center gap-1 bg-gray-100 rounded-lg pr-1">
                {editingColumnId === c.id ? (
                  <input autoFocus value={editColumnName} onChange={e => setEditColumnName(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && saveColumnName(c.id)}
                    className="text-xs bg-white border border-blue-300 rounded px-2 py-1 outline-none w-28" />
                ) : (
                  <span className="text-xs font-semibold text-gray-700 px-3 py-1.5">{c.name}</span>
                )}
                {editingColumnId === c.id ? (
                  <button onClick={() => saveColumnName(c.id)} className="text-[10px] font-semibold text-blue-600 px-1">Save</button>
                ) : (
                  <button onClick={() => { setEditingColumnId(c.id); setEditColumnName(c.name) }} className="text-gray-400 hover:text-gray-600 px-0.5" title="Rename">✎</button>
                )}
                <button onClick={() => deleteColumn(c.id)} className="text-gray-300 hover:text-red-500 px-0.5" title="Delete column">×</button>
              </div>
            ))}
            {showAddColumn ? (
              <div className="flex items-center gap-1">
                <input autoFocus value={newColumnName} onChange={e => setNewColumnName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addColumn()}
                  placeholder="Column name" className="text-xs bg-white border border-blue-300 rounded-lg px-2 py-1.5 outline-none w-32" />
                <button onClick={addColumn} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-blue-600 text-white">Add</button>
                <button onClick={() => { setShowAddColumn(false); setNewColumnName('') }} className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500">✕</button>
              </div>
            ) : (
              <button onClick={() => setShowAddColumn(true)} className={chipCls(false)}>+ New Column</button>
            )}
          </div>

          {columns.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
              <table className="w-full border-collapse text-xs">
                <thead>
                  <tr className="bg-gray-50">
                    {columns.map(c => (
                      <th key={c.id} className="text-left px-3 py-2 font-bold text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-200 whitespace-nowrap">
                        {c.name}
                      </th>
                    ))}
                    <th className="border-b border-gray-200 w-8" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(r => (
                    <tr key={r.id} className="border-b border-gray-100 last:border-0">
                      {columns.map(c => (
                        <td key={c.id} className="px-1 py-1">
                          <input value={r.values[c.id] ?? ''}
                            onChange={e => editCell(r.id, c.id, e.target.value)}
                            onBlur={e => saveCell(r.id, c.id, e.target.value)}
                            className="w-full min-w-[80px] text-xs px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 focus:border-blue-300 outline-none" />
                        </td>
                      ))}
                      <td className="px-1">
                        <button onClick={() => deleteRow(r.id)} className="text-gray-300 hover:text-red-500 px-1" title="Delete row">×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button onClick={addRow} className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50 border-t border-gray-100">
                + New Row
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
