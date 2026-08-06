'use client'
import { useState, useEffect } from 'react'
import { UK_PEOPLE } from './ukViewData'

type SubmenuOption = { id: number; label: string }

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

// UK's own Settings -- deliberately separate from Biz's SettingsPane
// (Viewing/Team/Users/Portal-As/Reorder Lists have nothing to do with UK).
// Submenus/columns were made "fixed from the UI's side" a while back (see
// ukViewData.ts's own comments), but the CRUD endpoints never went away --
// this is a small, self-contained admin form that calls them directly
// rather than reusing useUKData()'s addSubmenu/addColumn (those close over
// a single shared `person`/`selectedSubmenuId`, which would race against
// whatever the left pane has picked; a plain fetch per action here avoids
// that entirely). Row entry is already self-service via each submenu's own
// "+ New Row" button, so there's nothing to add for that here.
export default function UKSettingsPanel({ onChanged }: { onChanged: () => void }) {
  const [submenus, setSubmenus] = useState<SubmenuOption[]>([])
  const [loadingSubmenus, setLoadingSubmenus] = useState(true)

  const [section, setSection] = useState<string>(UK_PEOPLE[0])
  const [newMenuName, setNewMenuName] = useState('')
  const [addingMenu, setAddingMenu] = useState(false)
  const [menuResult, setMenuResult] = useState<string | null>(null)

  const [targetSubmenuId, setTargetSubmenuId] = useState<number | ''>('')
  const [newColumnName, setNewColumnName] = useState('')
  const [newColumnWide, setNewColumnWide] = useState(false)
  const [addingColumn, setAddingColumn] = useState(false)
  const [columnResult, setColumnResult] = useState<string | null>(null)

  function loadSubmenus() {
    setLoadingSubmenus(true)
    Promise.all([...UK_PEOPLE, 'General'].map(async p => {
      const r = await fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`)
      const list: { id: number; name: string }[] = r.ok ? await r.json() : []
      return list.map(s => ({ id: s.id, label: p === 'General' ? s.name : `${p} ${s.name}` }))
    })).then(lists => {
      setSubmenus(lists.flat())
      setLoadingSubmenus(false)
    }).catch(() => setLoadingSubmenus(false))
  }
  useEffect(() => { loadSubmenus() }, [])

  async function addMenu() {
    const name = newMenuName.trim()
    if (!name) return
    setAddingMenu(true)
    setMenuResult(null)
    const res = await fetch('/api/uk/submenus', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ person: section, name }),
    })
    setAddingMenu(false)
    if (res.ok) {
      setMenuResult(`Added "${section === 'General' ? name : `${section} ${name}`}".`)
      setNewMenuName('')
      loadSubmenus()
      onChanged()
    } else {
      setMenuResult('Could not add — try again.')
    }
  }

  async function addColumn() {
    const name = newColumnName.trim()
    if (!name || targetSubmenuId === '') return
    setAddingColumn(true)
    setColumnResult(null)
    const res = await fetch('/api/uk/columns', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submenu_id: targetSubmenuId, name, is_wide: newColumnWide }),
    })
    setAddingColumn(false)
    if (res.ok) {
      const menuLabel = submenus.find(s => s.id === targetSubmenuId)?.label ?? 'that menu'
      setColumnResult(`Added column "${name}" to ${menuLabel}.`)
      setNewColumnName('')
      setNewColumnWide(false)
    } else {
      setColumnResult('Could not add — try again.')
    }
  }

  return (
    <div className="p-3 space-y-4">
      <div className="space-y-1.5">
        <p className="text-xs font-bold text-gray-700">Add a menu or page</p>
        <p className="text-[10px] text-gray-400">Creates a new item in the left pane, under a person or the General Section.</p>
        <select value={section} onChange={e => setSection(e.target.value)} className={inputCls}>
          {UK_PEOPLE.map(p => <option key={p} value={p}>{p}</option>)}
          <option value="General">General Section</option>
        </select>
        <input value={newMenuName} onChange={e => setNewMenuName(e.target.value)}
          placeholder="Menu name (e.g. Investment)" className={inputCls} />
        <button onClick={addMenu} disabled={addingMenu || !newMenuName.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold rounded py-1.5 transition">
          {addingMenu ? 'Adding…' : '+ Add Menu'}
        </button>
        {menuResult && <p className="text-[10px] text-gray-500">{menuResult}</p>}
      </div>

      <div className="space-y-1.5 pt-3 border-t border-gray-200">
        <p className="text-xs font-bold text-gray-700">Add a column</p>
        <p className="text-[10px] text-gray-400">Adds a new column to an existing menu&apos;s table.</p>
        <select value={targetSubmenuId} onChange={e => setTargetSubmenuId(e.target.value ? Number(e.target.value) : '')}
          className={inputCls} disabled={loadingSubmenus}>
          <option value="">{loadingSubmenus ? 'Loading…' : '— Pick a menu —'}</option>
          {submenus.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
        </select>
        <input value={newColumnName} onChange={e => setNewColumnName(e.target.value)}
          placeholder="Column name" className={inputCls} />
        <label className="flex items-center gap-1.5 text-[10px] text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={newColumnWide} onChange={e => setNewColumnWide(e.target.checked)}
            className="w-3.5 h-3.5 accent-blue-600" />
          Wide field — full-width block below the table, for long text (options, notes, etc.) instead of a narrow cell
        </label>
        <button onClick={addColumn} disabled={addingColumn || !newColumnName.trim() || targetSubmenuId === ''}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[11px] font-bold rounded py-1.5 transition">
          {addingColumn ? 'Adding…' : '+ Add Column'}
        </button>
        {columnResult && <p className="text-[10px] text-gray-500">{columnResult}</p>}
      </div>

      <p className="text-[10px] text-gray-400 pt-3 border-t border-gray-200">
        Rows don&apos;t need Settings — open any menu and use its own &quot;+ New Row&quot; button.
      </p>
    </div>
  )
}
