'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'
import type { useUKData } from './ukViewData'

const chipCls = (active: boolean) =>
  `text-xs font-semibold px-3 py-1.5 rounded-lg transition
   ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`

// A cell holding a URL renders as a clickable link instead of a text box --
// no per-column "type" needed, the value itself decides.
const isUrlLike = (v: string) => /^https?:\/\//i.test(v.trim()) || /^www\./i.test(v.trim())
const toHref = (v: string) => /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`

// Just the right-pane content for whichever submenu is selected -- the
// people picker and that person's submenu list (with add/rename/delete)
// now live in item/page.tsx's merged pane instead (see ukViewData.ts's
// useUKData hook, called once there and passed down as `uk`).
export default function UKTab({ uk }: { uk: ReturnType<typeof useUKData> }) {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null)

  if (username !== 'grony') {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 text-sm">This page is private.</p>
      </div>
    )
  }

  const selectedSubmenu = uk.submenus.find(s => s.id === uk.selectedSubmenuId) ?? null

  if (!selectedSubmenu) {
    return <p className="py-20 text-center text-gray-400 text-xs px-4">Pick a submenu from the left to see its columns.</p>
  }

  return (
    <div className="space-y-4 pb-10 px-3 pt-3">
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Columns · {selectedSubmenu.name}</p>
        <div className="flex flex-wrap gap-1.5">
          {uk.columns.map(c => (
            <div key={c.id} className="flex items-center gap-1 bg-gray-100 rounded-lg pr-1">
              {uk.editingColumnId === c.id ? (
                <input autoFocus value={uk.editColumnName} onChange={e => uk.setEditColumnName(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && uk.saveColumnName(c.id)}
                  className="text-xs bg-white border border-blue-300 rounded px-2 py-1 outline-none w-28" />
              ) : (
                <span className="text-xs font-semibold text-gray-700 px-3 py-1.5">{c.name}</span>
              )}
              {uk.editingColumnId === c.id ? (
                <button onClick={() => uk.saveColumnName(c.id)} className="text-[10px] font-semibold text-blue-600 px-1">Save</button>
              ) : (
                <button onClick={() => { uk.setEditingColumnId(c.id); uk.setEditColumnName(c.name) }} className="text-gray-400 hover:text-gray-600 px-0.5" title="Rename">✎</button>
              )}
              <button onClick={() => uk.deleteColumn(c.id)} className="text-gray-300 hover:text-red-500 px-0.5" title="Delete column">×</button>
            </div>
          ))}
          {uk.showAddColumn ? (
            <div className="flex items-center gap-1">
              <input autoFocus value={uk.newColumnName} onChange={e => uk.setNewColumnName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && uk.addColumn()}
                placeholder="Column name" className="text-xs bg-white border border-blue-300 rounded-lg px-2 py-1.5 outline-none w-32" />
              <button onClick={uk.addColumn} className="text-xs font-semibold px-2 py-1.5 rounded-lg bg-blue-600 text-white">Add</button>
              <button onClick={() => { uk.setShowAddColumn(false); uk.setNewColumnName('') }} className="text-xs px-2 py-1.5 rounded-lg bg-gray-100 text-gray-500">✕</button>
            </div>
          ) : (
            <button onClick={() => uk.setShowAddColumn(true)} className={chipCls(false)}>+ New Column</button>
          )}
        </div>

        {uk.columns.length > 0 && (
          <div className="bg-white border border-gray-200 rounded-xl overflow-x-auto">
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-gray-50">
                  {uk.columns.map(c => (
                    <th key={c.id} className="text-left px-3 py-2 font-bold text-gray-400 text-[10px] uppercase tracking-wide border-b border-gray-200 whitespace-nowrap">
                      {c.name}
                    </th>
                  ))}
                  <th className="border-b border-gray-200 w-8" />
                </tr>
              </thead>
              <tbody>
                {uk.rows.map(r => (
                  <tr key={r.id} className="border-b border-gray-100 last:border-0">
                    {uk.columns.map(c => {
                      const val = r.values[c.id] ?? ''
                      const key = `${r.id}-${c.id}`
                      const showAsLink = isUrlLike(val) && editingCellKey !== key
                      return (
                        <td key={c.id} className="px-1 py-1">
                          {showAsLink ? (
                            <div className="flex items-center gap-1 px-2 py-1.5">
                              <a href={toHref(val)} target="_blank" rel="noopener noreferrer"
                                className="text-xs text-blue-600 underline truncate max-w-[140px]">{val}</a>
                              <button onClick={() => setEditingCellKey(key)} className="text-gray-300 hover:text-gray-600 shrink-0" title="Edit">✎</button>
                            </div>
                          ) : (
                            <input value={val} autoFocus={editingCellKey === key}
                              onChange={e => uk.editCell(r.id, c.id, e.target.value)}
                              onBlur={e => { uk.saveCell(r.id, c.id, e.target.value); setEditingCellKey(null) }}
                              className="w-full min-w-[80px] text-xs px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 focus:border-blue-300 outline-none" />
                          )}
                        </td>
                      )
                    })}
                    <td className="px-1">
                      <button onClick={() => uk.deleteRow(r.id)} className="text-gray-300 hover:text-red-500 px-1" title="Delete row">×</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <button onClick={uk.addRow} className="w-full text-left px-3 py-2 text-xs font-semibold text-blue-600 hover:bg-gray-50 border-t border-gray-100">
              + New Row
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
