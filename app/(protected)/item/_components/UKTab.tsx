'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import SubmenuTable from './SubmenuTable'
import { UK_PEOPLE, type UKSubmenu, type UKColumn, type UKRow } from './ukViewData'

type SubmenuData = { columns: UKColumn[]; rows: UKRow[] }

// Every person's every submenu, all rendered at once -- names alone (e.g.
// "Grony NVQ Level 3" vs "Grony Urgent" vs "Mina Level 3") gave no sense of
// what was actually in each one without clicking through People then
// Submenus one at a time. This fetches every UK_PEOPLE person's submenus
// plus each submenu's own columns/rows up front and lists them all in one
// scrollable page instead. The People/Submenus picker in item/page.tsx's
// side pane still works (still reads/writes the same uk_* tables via
// useUKData), it just no longer needs to be clicked to see anything here.
export default function UKTab() {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()

  const [submenusByPerson, setSubmenusByPerson] = useState<Record<string, UKSubmenu[]>>({})
  const [dataBySubmenu, setDataBySubmenu] = useState<Record<number, SubmenuData>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (username !== 'grony') return
    let cancelled = false
    async function loadAll() {
      const perPerson = await Promise.all(UK_PEOPLE.map(async p => {
        const r = await fetch(`/api/uk/submenus?person=${encodeURIComponent(p)}`)
        const submenus: UKSubmenu[] = r.ok ? await r.json() : []
        return [p, submenus] as const
      }))
      if (cancelled) return
      const map: Record<string, UKSubmenu[]> = {}
      for (const [p, submenus] of perPerson) map[p] = submenus
      setSubmenusByPerson(map)

      const allSubmenus = perPerson.flatMap(([, s]) => s)
      const dataEntries = await Promise.all(allSubmenus.map(async s => {
        const [colRes, rowRes] = await Promise.all([
          fetch(`/api/uk/columns?submenu_id=${s.id}`),
          fetch(`/api/uk/rows?submenu_id=${s.id}`),
        ])
        const columns: UKColumn[] = colRes.ok ? await colRes.json() : []
        const rows: UKRow[] = rowRes.ok ? await rowRes.json() : []
        return [s.id, { columns, rows }] as const
      }))
      if (cancelled) return
      const dmap: Record<number, SubmenuData> = {}
      for (const [id, d] of dataEntries) dmap[id] = d
      setDataBySubmenu(dmap)
      setLoading(false)
    }
    loadAll()
    return () => { cancelled = true }
  }, [username])

  function editCell(submenuId: number, rowId: number, columnId: number, value: string) {
    setDataBySubmenu(prev => {
      const d = prev[submenuId]
      if (!d) return prev
      return { ...prev, [submenuId]: { ...d, rows: d.rows.map(r => r.id === rowId ? { ...r, values: { ...r.values, [columnId]: value } } : r) } }
    })
  }
  async function saveCell(rowId: number, columnId: number, value: string) {
    await fetch(`/api/uk/rows/${rowId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: { [columnId]: value } }),
    }).catch(() => {})
  }
  async function addRow(submenuId: number) {
    const res = await fetch('/api/uk/rows', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submenu_id: submenuId, values: {} }),
    })
    if (res.ok) {
      const row: UKRow = await res.json()
      setDataBySubmenu(prev => {
        const d = prev[submenuId]
        if (!d) return prev
        return { ...prev, [submenuId]: { ...d, rows: [...d.rows, row] } }
      })
    }
  }
  async function deleteRow(submenuId: number, id: number) {
    if (!confirm('Delete this row?')) return
    setDataBySubmenu(prev => {
      const d = prev[submenuId]
      if (!d) return prev
      return { ...prev, [submenuId]: { ...d, rows: d.rows.filter(r => r.id !== id) } }
    })
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

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const anySubmenus = UK_PEOPLE.some(p => (submenusByPerson[p] ?? []).length > 0)
  if (!anySubmenus) return <p className="py-20 text-center text-gray-400 text-xs px-4">No submenus yet.</p>

  return (
    <div className="space-y-6 pb-10">
      {UK_PEOPLE.map(person => {
        const submenus = submenusByPerson[person] ?? []
        if (submenus.length === 0) return null
        return (
          <div key={person}>
            <p className="px-3 pt-2 pb-1 text-sm font-extrabold text-gray-900 sticky top-0 bg-white/95 backdrop-blur z-10 border-b border-gray-100">
              {person}
            </p>
            <div className="space-y-3">
              {submenus.map(s => {
                const d = dataBySubmenu[s.id] ?? { columns: [], rows: [] }
                return (
                  <div key={s.id} id={`uk-submenu-${s.id}`} className="scroll-mt-10">
                    <SubmenuTable submenu={s} columns={d.columns} rows={d.rows}
                      editCell={(rowId, colId, val) => editCell(s.id, rowId, colId, val)}
                      saveCell={saveCell}
                      deleteRow={id => deleteRow(s.id, id)}
                      addRow={() => addRow(s.id)} />
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
