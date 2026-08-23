'use client'
import { useState, useRef, useEffect } from 'react'
import { COUNT_EXCLUDED_REASONS } from '@/lib/countRules'
import { GMCBadge } from './GMCBadge'

// The item-fields-only edit form (name/group/prices/units/conversion/count
// settings) -- split out of LossTab.tsx so it can be reused anywhere an
// item needs editing without dragging in LossTab's much heavier ItemDetail
// (merge/alias-picker/matches/pack-chain history), which isn't relevant
// outside the Loss by Item tab itself.
export const EMPTY_ITEM_EDIT_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
  converts_to_item_id: '', count_excluded: false, count_cadence_days: '', count_excluded_reason: '',
  gmc_type: '',
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
  },
} as const

// Fixed cadence choices instead of a free-form number -- covers the
// cadences the shop actually uses in practice; "Other…" below still opens a
// plain number input for anything outside this set, and preserves whatever
// arbitrary value an item was already set to (see customCadence below)
// instead of silently discarding it because it doesn't match a preset.
const CADENCE_PRESETS: { value: string; label: string }[] = [
  { value: '1', label: 'Daily' },
  { value: '3', label: 'Every 3 Days' },
  { value: '7', label: 'Every 7 Days' },
  { value: '15', label: 'Every 15 Days' },
  { value: '30', label: 'Every 30 Days' },
  { value: '45', label: 'Every 45 Days' },
]

export function ItemEditForm({ form, onChange, groups, itemId, isService, allItems, size = 'compact', currentCountInterval, currentSoh, onGmcTypeSave }: {
  form: typeof EMPTY_ITEM_EDIT_FORM; onChange: (f: typeof EMPTY_ITEM_EDIT_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string }[]
  size?: 'compact' | 'large'
  // What this item's cadence actually resolves to right now (e.g. "Every
  // 15d", "Dormant", "Daily") -- without this, "Count every ___ days" is a
  // blank field with no way to tell whether leaving it on auto is already
  // doing what you want. undefined while still loading; null once loaded
  // if the item genuinely has no interval (a service, or the label lookup
  // failed) -- both render nothing.
  currentCountInterval?: string | null
  // The item's live stock-on-hand -- Exclude only actually takes (the PUT
  // route rejects it server-side otherwise) once this is 0, so shown here
  // as a heads-up before the user tries, not as the real enforcement.
  currentSoh?: number | null
  // Called when the user clicks the tick button next to GMC Type dropdown
  onGmcTypeSave?: (gmcType: string) => void | Promise<void>
}) {
  const s = SIZES[size]
  const large = size === 'large'
  const [gmcSaving, setGmcSaving] = useState(false)
  const [gmcSaved, setGmcSaved] = useState(false)
  const gmcSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleGmcTypeSave = async () => {
    if (!onGmcTypeSave) return
    setGmcSaving(true)
    try {
      await onGmcTypeSave(form.gmc_type)
      setGmcSaved(true)
      if (gmcSavedTimeoutRef.current) clearTimeout(gmcSavedTimeoutRef.current)
      gmcSavedTimeoutRef.current = setTimeout(() => setGmcSaved(false), 2000)
    } finally {
      setGmcSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (gmcSavedTimeoutRef.current) clearTimeout(gmcSavedTimeoutRef.current)
    }
  }, [])

  const set = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  const setCheckbox = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [k]: e.target.checked })
  const gmcOptions = [
    { value: '', label: '— None —' },
    { value: 'gmc', label: 'GMC only, no service' },
    { value: 'service_gmc', label: 'Is both service and GMC alone' },
    { value: 'service_gmc_serving', label: 'Is Service and GMC serving other services' },
    { value: 'service_using_gmc', label: 'Is service using another GMC' },
    { value: 'service_no_gmc', label: 'Is service no GMC' },
    { value: 'pack_to_gmc', label: 'Pack here, I convert to a GMC' },
  ]
  // Existing groups only show up here once some item already uses them --
  // "+ New group name…" (same option NewItemForm offers) is what lets you
  // introduce one while editing an item instead of only from New Item.
  const [customGroup, setCustomGroup] = useState(!!form.cf_group && !groups.includes(form.cf_group))
  // Same pattern as Group's "+ New group name…" -- a reason typed free-hand
  // that doesn't match one of the fixed options is treated as "Other" with
  // its own text box, rather than being lost/misrepresented as blank.
  const presetReasonLabels: string[] = COUNT_EXCLUDED_REASONS.filter(r => r.key !== 'other').map(r => r.label)
  const [customReason, setCustomReason] = useState(!!form.count_excluded_reason && !presetReasonLabels.includes(form.count_excluded_reason))
  // Same "Other…" pattern -- an item already on a cadence outside the fixed
  // preset list (set before this dropdown existed, or a genuinely unusual
  // one) shows up here instead of the select silently falling back to a
  // preset it doesn't actually match.
  const presetCadenceValues: string[] = CADENCE_PRESETS.map(p => p.value)
  const [customCadence, setCustomCadence] = useState(!!form.count_cadence_days && !presetCadenceValues.includes(form.count_cadence_days))
  const stockBlocksExclude = currentSoh != null && Math.abs(currentSoh) > 0.001
  return (
    <div className={s.wrap}>
      <div>
        {large && <label className={s.label}>Item name <span className="text-red-600">*</span></label>}
        <div className="flex items-center gap-1">
          <input placeholder="Item name *" value={form.item_name} onChange={set('item_name')} className={s.input} />
          <GMCBadge gmcType={form.gmc_type} size={large ? 'medium' : 'small'} />
        </div>
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
      <div>
        {large && <label className={s.label}>GMC Type</label>}
        <div className="flex items-center gap-1">
          <select value={form.gmc_type} onChange={set('gmc_type')} className={s.input}>
            {gmcOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          {onGmcTypeSave && (
            <button
              type="button"
              onClick={handleGmcTypeSave}
              disabled={gmcSaving}
              className={`shrink-0 font-bold text-white rounded transition ${
                large
                  ? 'px-3 py-2.5 text-base'
                  : 'px-1.5 py-0.5 text-xs'
              } ${
                gmcSaved
                  ? 'bg-green-700'
                  : gmcSaving
                  ? 'bg-blue-600 opacity-75 cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700'
              }`}
              title={gmcSaving ? 'Saving...' : gmcSaved ? 'Saved!' : 'Save GMC Type'}>
              {gmcSaving ? '⏳' : gmcSaved ? '✓' : '✓'}
            </button>
          )}
        </div>
      </div>
      {!isService && (
        <div className={s.sectionWrap}>
          <label className={s.sectionLabel}>Stock counts</label>
          {currentCountInterval && (
            <p className={large ? 'text-xs text-gray-500 -mt-1 mb-1' : 'text-[8px] text-gray-500 -mt-0.5 mb-0.5'}>
              Currently: <span className="font-semibold text-gray-700">{currentCountInterval}</span>
              {!form.count_excluded && !form.count_cadence_days && currentCountInterval !== 'Daily' && (
                <> (automatic)</>
              )}
            </p>
          )}
          <label className={s.checkboxLabel}>
            <input type="checkbox" checked={form.count_excluded}
              onChange={e => onChange({ ...form, count_excluded: e.target.checked, count_excluded_reason: e.target.checked ? form.count_excluded_reason : '' })}
              className={s.checkbox} />
            Exclude from counts entirely
          </label>
          {form.count_excluded && (
            <div className={large ? 'space-y-2' : 'space-y-1'}>
              {stockBlocksExclude ? (
                <p className={(large ? 'text-xs' : 'text-[9px]') + ' text-red-600 font-semibold'}>
                  Still shows {currentSoh} in stock -- bring it to 0 (a count, or a sale/bill that clears it out) before this can take effect.
                </p>
              ) : currentSoh === 0 ? (
                <p className={(large ? 'text-xs' : 'text-[9px]') + ' text-green-600'}>Stock is 0 -- ready to exclude.</p>
              ) : null}
              <div>
                {large && <label className={s.label}>Why is it being excluded?</label>}
                <select
                  value={customReason ? '__other__' : (form.count_excluded_reason || '')}
                  onChange={e => {
                    if (e.target.value === '__other__') { setCustomReason(true); onChange({ ...form, count_excluded_reason: '' }) }
                    else { setCustomReason(false); onChange({ ...form, count_excluded_reason: e.target.value }) }
                  }}
                  className={s.input}>
                  <option value="">— Select a reason —</option>
                  {COUNT_EXCLUDED_REASONS.filter(r => r.key !== 'other').map(r => (
                    <option key={r.key} value={r.label}>{r.label}</option>
                  ))}
                  <option value="__other__">Other…</option>
                </select>
                {customReason && (
                  <input value={form.count_excluded_reason} onChange={set('count_excluded_reason')}
                    placeholder="Describe the reason" className={s.input + (large ? ' mt-2' : ' mt-1')} />
                )}
              </div>
            </div>
          )}
          {!form.count_excluded && (
            <div>
              {large ? <label className={s.label}>Count every</label> : <span className={s.smallText}>Count every</span>}
              <select
                value={customCadence ? '__custom__' : form.count_cadence_days}
                onChange={e => {
                  if (e.target.value === '__custom__') { setCustomCadence(true); onChange({ ...form, count_cadence_days: '' }) }
                  else { setCustomCadence(false); onChange({ ...form, count_cadence_days: e.target.value }) }
                }}
                className={s.input + (large ? '' : ' mt-0.5')}>
                <option value="">Automatic (based on item history)</option>
                {CADENCE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                <option value="__custom__">Other…</option>
              </select>
              {customCadence && (
                <input type="number" min="1" step="1" placeholder="Number of days" value={form.count_cadence_days}
                  onChange={set('count_cadence_days')} className={s.input + (large ? ' mt-2' : ' mt-1')} />
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
