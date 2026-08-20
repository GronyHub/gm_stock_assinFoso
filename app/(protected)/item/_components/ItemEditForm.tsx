'use client'
import { useState } from 'react'

// The item-fields-only edit form (name/group/prices/units/conversion/count
// settings) -- split out of LossTab.tsx so it can be reused anywhere an
// item needs editing without dragging in LossTab's much heavier ItemDetail
// (merge/alias-picker/matches/pack-chain history), which isn't relevant
// outside the Loss by Item tab itself.
export const EMPTY_ITEM_EDIT_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
  converts_to_item_id: '', count_excluded: false, count_cadence_days: '',
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

export function ItemEditForm({ form, onChange, groups, itemId, isService, allItems }: {
  form: typeof EMPTY_ITEM_EDIT_FORM; onChange: (f: typeof EMPTY_ITEM_EDIT_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string }[]
}) {
  const set = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  // Existing groups only show up here once some item already uses them --
  // "+ New group name…" (same option NewItemForm offers) is what lets you
  // introduce one while editing an item instead of only from New Item.
  const [customGroup, setCustomGroup] = useState(!!form.cf_group && !groups.includes(form.cf_group))
  return (
    <div className="space-y-1 p-2 bg-gray-50 border-b border-gray-200">
      <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={inputCls} />
      <select value={customGroup ? '__custom__' : form.cf_group}
        onChange={e => {
          if (e.target.value === '__custom__') { setCustomGroup(true); onChange({ ...form, cf_group: '' }) }
          else { setCustomGroup(false); onChange({ ...form, cf_group: e.target.value }) }
        }}
        className={inputCls}>
        <option value="">— No group —</option>
        {groups.map(g => <option key={g} value={g}>{g}</option>)}
        <option value="__custom__">+ New group name…</option>
      </select>
      {customGroup && (
        <input value={form.cf_group} onChange={set('cf_group')} placeholder="Type new group name" className={inputCls} />
      )}
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="SP" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={inputCls} />
        <input placeholder="CP" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={inputCls} />
      </div>
      <div className="grid grid-cols-2 gap-1">
        <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={inputCls} />
        <input placeholder="Unit" value={form.unit_name} onChange={set('unit_name')} className={inputCls} />
      </div>
      <div>
        <label className="text-[7px] font-bold text-gray-500 block mb-0">
          {isService
            ? 'On sale (WIC), deduct "Units/pack" of this service from:'
            : 'On GMC, credit "Units/pack" of this item into:'}
        </label>
        <select value={form.converts_to_item_id} onChange={set('converts_to_item_id')} className={inputCls}>
          <option value="">— No conversion —</option>
          {allItems.filter(i => i.item_id !== itemId).map(i => (
            <option key={i.item_id} value={i.item_id}>{i.item_name}</option>
          ))}
        </select>
      </div>
      {!isService && (
        <div className="pt-1 border-t border-gray-200 space-y-1">
          <label className="text-[7px] font-bold text-gray-500 block">Stock counts</label>
          <label className="flex items-center gap-1.5 text-[9px] text-gray-700 cursor-pointer select-none">
            <input type="checkbox" checked={form.count_excluded}
              onChange={e => onChange({ ...form, count_excluded: e.target.checked })}
              className="w-3 h-3 accent-red-600" />
            Exclude from counts entirely
          </label>
          {!form.count_excluded && (
            <div className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-500 shrink-0">Count every</span>
              <input type="number" min="1" step="1" placeholder="auto" value={form.count_cadence_days}
                onChange={set('count_cadence_days')} className={inputCls + ' w-14'} />
              <span className="text-[9px] text-gray-500 shrink-0">days (blank = automatic)</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
