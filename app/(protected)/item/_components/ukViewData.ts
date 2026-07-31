'use client'
import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'

// UK's own state -- lives here (not inside UKTab.tsx) so item/page.tsx can
// call the hook once and feed both the pane (people + that person's
// submenus, with add/rename/delete) and the content area (the selected
// submenu's columns + row data) from the same source, same split as
// Manage's dynamic categories (see manageViewData.ts).
export type UKPerson = 'Grony' | 'Mina' | 'Prisca'
export const UK_PEOPLE: UKPerson[] = ['Grony', 'Mina', 'Prisca']

export type UKSubmenu = { id: number; person: string; name: string; sort_order: number; created_at: string }
export type UKColumn = { id: number; submenu_id: number; name: string; sort_order: number; created_at: string }
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

  function loadSubmenus(p: UKPerson) {
    fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => setSubmenus(Array.isArray(d) ? d : []))
      .catch(() => {})
  }
  useEffect(() => {
    if (username !== 'grony') return
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

  return {
    person, pickPerson, submenus, selectedSubmenuId, pickSubmenu, columns, rows,
    newSubmenuName, setNewSubmenuName, showAddSubmenu, setShowAddSubmenu,
    editingSubmenuId, setEditingSubmenuId, editSubmenuName, setEditSubmenuName,
    addSubmenu, saveSubmenuName, deleteSubmenu,
    newColumnName, setNewColumnName, showAddColumn, setShowAddColumn,
    editingColumnId, setEditingColumnId, editColumnName, setEditColumnName,
    addColumn, saveColumnName, deleteColumn,
    addRow, editCell, saveCell, deleteRow,
  }
}
