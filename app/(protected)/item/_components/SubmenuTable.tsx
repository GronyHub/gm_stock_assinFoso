'use client'
import { useState } from 'react'
import PageToolIcons from './PageToolIcons'
import type { UKColumn, UKRow, UKSubmenu } from './ukViewData'

// A cell holding a URL renders as a clickable link instead of a text box --
// no per-column "type" needed, the value itself decides.
const isUrlLike = (v: string) => /^https?:\/\//i.test(v.trim()) || /^www\./i.test(v.trim())
const toHref = (v: string) => /^https?:\/\//i.test(v.trim()) ? v.trim() : `https://${v.trim()}`

// The editable columns+rows table for one selected submenu -- split out of
// UKTab.tsx so CHTab.tsx can render the exact same table for Fiifi/Kuukua/
// Ebo/Odoye's submenus (moved there from UK, see chViewData.ts's
// CH_CHILD_PERSON) without duplicating this markup. Both read from the same
// uk_submenus/uk_columns/uk_rows tables via useUKData, just scoped to a
// different fixed person list. Columns are fixed from the UI's side (no
// self-service add/rename/delete); row data entry below still works
// normally.
export default function SubmenuTable({ submenu, columns, rows, editCell, saveCell, deleteRow, addRow }: {
  submenu: UKSubmenu
  columns: UKColumn[]
  rows: UKRow[]
  editCell: (rowId: number, columnId: number, value: string) => void
  saveCell: (rowId: number, columnId: number, value: string) => void
  deleteRow: (id: number) => void
  addRow: () => void
}) {
  const [editingCellKey, setEditingCellKey] = useState<string | null>(null)

  return (
    <div className="space-y-4 pb-10 px-3 pt-3">
      <PageToolIcons scopeKey={`${submenu.person} ${submenu.name}`} />
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide">Columns · {submenu.name}</p>
        <div className="flex flex-wrap gap-1.5">
          {columns.map(c => (
            <span key={c.id} className="text-xs font-semibold text-gray-700 bg-gray-100 rounded-lg px-3 py-1.5">{c.name}</span>
          ))}
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
                    {columns.map(c => {
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
                              onChange={e => editCell(r.id, c.id, e.target.value)}
                              onBlur={e => { saveCell(r.id, c.id, e.target.value); setEditingCellKey(null) }}
                              className="w-full min-w-[80px] text-xs px-2 py-1.5 rounded-lg border border-transparent hover:border-gray-200 focus:border-blue-300 outline-none" />
                          )}
                        </td>
                      )
                    })}
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
    </div>
  )
}
