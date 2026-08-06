'use client'
import { useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'

// UK's own state -- lives here (not inside UKTab.tsx) so item/page.tsx can
// call the hook once and feed both the pane (people + that person's
// submenus) and the content area (the selected submenu's columns + row
// data) from the same source. Submenu/column names are fixed from the
// UI's side -- no self-service add/rename/delete -- but the CRUD
// functions below stay in place since they're the mechanism for making
// that kind of change directly when asked, and row data entry is
// unaffected.
// Fiifi/Kuukua/Ebo/Odoye moved to C&H (see CH_CHILD_PERSON in
// chViewData.ts) -- UK_PEOPLE (the actual people picker UK's own pane
// shows) drops them, but the UKPerson type keeps all seven, since
// item/page.tsx runs a second useUKData() instance for C&H's own child
// pages, driven by CH_CHILD_PERSON instead of this list, calling
// `pickPerson` with one of these same four names. Their submenus (Health,
// Education, ... below) are seeded server-side the first time any
// /api/uk/* route runs -- see ensureChildLogSubmenus in lib/ukTables.ts.
// The person names here have to match those seeded rows exactly, since
// `person` is a plain string column, not a foreign key into anything.
export type UKPerson = 'Grony' | 'Mina' | 'Prisca' | 'Fiifi' | 'Kuukua' | 'Ebo' | 'Odoye'
export const UK_PEOPLE: UKPerson[] = ['Grony', 'Mina', 'Prisca']

export type UKSubmenu = { id: number; person: string; name: string; sort_order: number; created_at: string }
// is_wide: renders full-width below the table instead of a resizable grid
// column -- for fields with too much text to fit comfortably in a cell
// (see SubmenuTable.tsx).
export type UKColumn = { id: number; submenu_id: number; name: string; sort_order: number; created_at: string; is_wide: boolean }
export type UKRow = { id: number; submenu_id: number; sort_order: number; created_at: string; values: Record<number, string> }

export function useUKData() {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()

  const [person, setPersonState] = useState<UKPerson>('Grony')
  const [submenus, setSubmenus] = useState<UKSubmenu[]>([])
  const [selectedSubmenuId, setSelectedSubmenuIdState] = useState<number | null>(null)
  const [columns, setColumns] = useState<UKColumn[]>([])
  const [rows, setRows] = useState<UKRow[]>([])

  const [newSubmenuName, setNewSubmenuName] = useState('')
  const [showAddSubmenu, setShowAddSubmenu] = useState(false)
  const [editingSubmenuId, setEditingSubmenuId] = useState<number | null>(null)
  const [editSubmenuName, setEditSubmenuName] = useState('')

  const [newColumnName, setNewColumnName] = useState('')
  const [showAddColumn, setShowAddColumn] = useState(false)
  const [editingColumnId, setEditingColumnId] = useState<number | null>(null)
  const [editColumnName, setEditColumnName] = useState('')

  // C&H's `ch` instance mounts defaulted to 'Grony' (see useState below),
  // then gets corrected to the right child a moment later -- either by
  // pickCHView on a click, or by item/page.tsx's URL-restore effect on a
  // refresh/back-forward/bookmarked link. That correction fires a second
  // fetch, but the FIRST one (for 'Grony') is still in flight and has no
  // reason to know it's now stale -- if it happens to resolve after the
  // correct one, its response overwrites the right data with Grony's own
  // submenus and nothing ever re-fetches to undo it. personRef always holds
  // the most-recently-requested person, so a response that no longer
  // matches it (a newer request having since superseded it) is just dropped
  // instead of applied.
  const personRef = useRef(person)
  useEffect(() => { personRef.current = person }, [person])

  function loadSubmenus(p: UKPerson) {
    fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (personRef.current !== p) return
        setSubmenus(Array.isArray(d) ? d : [])
      })
      .catch(() => {})
  }
  useEffect(() => {
    if (username !== 'grony') return
    loadSubmenus(person)
  }, [person, username])

  // Which submenu the CURRENT `columns`/`rows` state actually belongs to --
  // tracked explicitly rather than inferred from the data itself, since an
  // empty `columns`/`rows` array is indistinguishable from "hasn't loaded
  // yet" using content alone (an empty array vacuously matches any
  // submenu_id check). UKTab.tsx/CHTab.tsx compare this against the
  // selected submenu before ever handing columns/rows to SubmenuTable --
  // see their comments for why stale/not-yet-loaded data collapses the
  // table's column widths. selectedSubmenuIdRef guards against an
  // out-of-order response too (a slow fetch for a submenu the user has
  // since clicked away from resolving after the newer one already has).
  const [columnsSubmenuId, setColumnsSubmenuId] = useState<number | null>(null)
  const [rowsSubmenuId, setRowsSubmenuId] = useState<number | null>(null)
  const selectedSubmenuIdRef = useRef(selectedSubmenuId)
  useEffect(() => { selectedSubmenuIdRef.current = selectedSubmenuId }, [selectedSubmenuId])

  function loadColumns(submenuId: number) {
    fetch(`/api/uk/columns?submenu_id=${submenuId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (selectedSubmenuIdRef.current !== submenuId) return
        setColumns(Array.isArray(d) ? d : [])
        setColumnsSubmenuId(submenuId)
      })
      .catch(() => {})
  }
  useEffect(() => {
    if (selectedSubmenuId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setColumns([])
      setColumnsSubmenuId(null)
      return
    }
    loadColumns(selectedSubmenuId)
  }, [selectedSubmenuId])

  function loadRows(submenuId: number) {
    fetch(`/api/uk/rows?submenu_id=${submenuId}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => {
        if (selectedSubmenuIdRef.current !== submenuId) return
        setRows(Array.isArray(d) ? d : [])
        setRowsSubmenuId(submenuId)
      })
      .catch(() => {})
  }
  useEffect(() => {
    if (selectedSubmenuId == null) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRows([])
      setRowsSubmenuId(null)
      return
    }
    loadRows(selectedSubmenuId)
  }, [selectedSubmenuId])

  function pickPerson(p: UKPerson) {
    setPersonState(p)
    setSelectedSubmenuIdState(null)
  }
  function pickSubmenu(id: number) {
    setSelectedSubmenuIdState(id)
  }

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
    const s = submenus.find(x => x.id === id)
    if (!confirm(`Delete "${s?.name ?? 'this submenu'}" and everything in it?`)) return
    setSubmenus(prev => prev.filter(s => s.id !== id))
    if (selectedSubmenuId === id) setSelectedSubmenuIdState(null)
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
    const c = columns.find(x => x.id === id)
    if (!confirm(`Delete column "${c?.name ?? 'this column'}"? This removes it and its data from every row.`)) return
    setColumns(prev => prev.filter(c => c.id !== id))
    await fetch(`/api/uk/columns/${id}`, { method: 'DELETE' }).catch(() => {})
  }
  // Switches an EXISTING column between the resizable grid and a full-width
  // block per row -- not just something a column can be born as (see
  // addColumn's UKSettingsPanel caller), since text a column was created to
  // hold can turn out to need more room than expected once real content
  // (like a long pasted letter) lands in it.
  async function toggleColumnWide(id: number, isWide: boolean) {
    const c = columns.find(x => x.id === id)
    if (!c) return
    setColumns(prev => prev.map(x => x.id === id ? { ...x, is_wide: isWide } : x))
    await fetch(`/api/uk/columns/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: c.name, is_wide: isWide }),
    }).catch(() => {})
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
    if (!confirm('Delete this row?')) return
    setRows(prev => prev.filter(r => r.id !== id))
    await fetch(`/api/uk/rows/${id}`, { method: 'DELETE' }).catch(() => {})
  }

  return {
    person, pickPerson, submenus, selectedSubmenuId, pickSubmenu, columns, rows,
    columnsSubmenuId, rowsSubmenuId,
    newSubmenuName, setNewSubmenuName, showAddSubmenu, setShowAddSubmenu,
    editingSubmenuId, setEditingSubmenuId, editSubmenuName, setEditSubmenuName,
    addSubmenu, saveSubmenuName, deleteSubmenu,
    newColumnName, setNewColumnName, showAddColumn, setShowAddColumn,
    editingColumnId, setEditingColumnId, editColumnName, setEditColumnName,
    addColumn, saveColumnName, deleteColumn, toggleColumnWide,
    addRow, editCell, saveCell, deleteRow,
  }
}
