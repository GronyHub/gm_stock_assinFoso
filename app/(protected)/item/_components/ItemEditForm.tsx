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

// 'compact' is LossTab's original dense inline-table-row styling (unchanged
// -- that context has many rows on screen at once and needs to stay small).
// 'large' is a full-size form for contexts where this is the only thing on
// screen, like Live Sale's sale-tap sheet -- real labels above each field
// instead of relying on placeholder text, and input sizing that matches the
// rest of that sheet (Quantity/Price fields) rather than a table cell.
const SIZES = {
  compact: {
    wrap: 'space-y-1 p-2 bg-gray-50 border-b border-gray-200',
    input: 'w-full bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 text-[9px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400',
    label: '',
    fieldGap: 'gap-1',
    sectionLabel: 'text-[7px] font-bold text-gray-500 block',
    sectionWrap: 'pt-1 border-t border-gray-200 space-y-1',
    checkboxLabel: 'flex items-center gap-1.5 text-[9px] text-gray-700 cursor-pointer select-none',
    checkbox: 'w-3 h-3 accent-red-600',
    smallText: 'text-[9px] text-gray-500 shrink-0',
    cadenceInputExtra: ' w-14',
    cadenceGap: 'gap-1.5',
  },
  large: {
    wrap: 'space-y-4',
    input: 'w-full text-base text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-blue-400',
    label: 'block text-xs font-semibold text-gray-700 mb-1.5',
    fieldGap: 'gap-3',
    sectionLabel: 'text-xs font-bold text-gray-500 block mb-2',
    sectionWrap: 'pt-4 border-t border-gray-200 space-y-3',
    checkboxLabel: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none',
    checkbox: 'w-4 h-4 accent-red-600',
    smallText: 'text-sm text-gray-600 shrink-0',
    cadenceInputExtra: ' w-24',
    cadenceGap: 'gap-2',
  },
} as const

export function ItemEditForm({ form, onChange, groups, itemId, isService, allItems, size = 'compact' }: {
  form: typeof EMPTY_ITEM_EDIT_FORM; onChange: (f: typeof EMPTY_ITEM_EDIT_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string }[]
  size?: 'compact' | 'large'
}) {
  const s = SIZES[size]
  const large = size === 'large'
  const set = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  // Existing groups only show up here once some item already uses them --
  // "+ New group name…" (same option NewItemForm offers) is what lets you
  // introduce one while editing an item instead of only from New Item.
  const [customGroup, setCustomGroup] = useState(!!form.cf_group && !groups.includes(form.cf_group))
  return (
    <div className={s.wrap}>
      <div>
        {large && <label className={s.label}>Item name <span className="text-red-600">*</span></label>}
        <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={s.input} />
      </div>
      <div>
        {large && <label className={s.label}>Group</label>}
        <select value={customGroup ? '__custom__' : form.cf_group}
          onChange={e => {
            if (e.target.value === '__custom__') { setCustomGroup(true); onChange({ ...form, cf_group: '' }) }
            else { setCustomGroup(false); onChange({ ...form, cf_group: e.target.value }) }
          }}
          className={s.input}>
          <option value="">— No group —</option>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
          <option value="__custom__">+ New group name…</option>
        </select>
        {customGroup && (
          <input value={form.cf_group} onChange={set('cf_group')} placeholder="Type new group name"
            className={s.input + (large ? ' mt-2' : '')} />
        )}
      </div>
      <div className={`grid grid-cols-2 ${s.fieldGap}`}>
        <div>
          {large && <label className={s.label}>Selling price</label>}
          <input placeholder="SP" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={s.input} />
        </div>
        <div>
          {large && <label className={s.label}>Cost price</label>}
          <input placeholder="CP" type="number" value={form.purchase_rate} onChange={set('purchase_rate')} className={s.input} />
        </div>
      </div>
      <div className={`grid grid-cols-2 ${s.fieldGap}`}>
        <div>
          {large && <label className={s.label}>Units per pack</label>}
          <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={s.input} />
        </div>
        <div>
          {large && <label className={s.label}>Unit name</label>}
          <input placeholder="Unit" value={form.unit_name} onChange={set('unit_name')} className={s.input} />
        </div>
      </div>
      <div>
        <label className={large ? s.label : 'text-[7px] font-bold text-gray-500 block mb-0'}>
          {isService
            ? 'On sale (WIC), deduct "Units/pack" of this service from:'
            : 'On GMC, credit "Units/pack" of this item into:'}
        </label>
        <select value={form.converts_to_item_id} onChange={set('converts_to_item_id')} className={s.input}>
          <option value="">— No conversion —</option>
          {allItems.filter(i => i.item_id !== itemId).map(i => (
            <option key={i.item_id} value={i.item_id}>{i.item_name}</option>
          ))}
        </select>
      </div>
      {!isService && (
        <div className={s.sectionWrap}>
          <label className={s.sectionLabel}>Stock counts</label>
          <label className={s.checkboxLabel}>
            <input type="checkbox" checked={form.count_excluded}
              onChange={e => onChange({ ...form, count_excluded: e.target.checked })}
              className={s.checkbox} />
            Exclude from counts entirely
          </label>
          {!form.count_excluded && (
            <div className={`flex items-center ${s.cadenceGap}`}>
              <span className={s.smallText}>Count every</span>
              <input type="number" min="1" step="1" placeholder="auto" value={form.count_cadence_days}
                onChange={set('count_cadence_days')} className={s.input + s.cadenceInputExtra} />
              <span className={s.smallText}>days (blank = automatic)</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
