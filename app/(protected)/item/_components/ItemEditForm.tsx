'use client'
import { useState, useRef, useEffect } from 'react'
import { COUNT_EXCLUDED_REASONS } from '@/lib/countRules'
import { trimZeros } from '@/lib/fmtNumber'
import { formatDuration } from '@/lib/fmtDuration'

// The item-fields-only edit form (name/group/prices/units/conversion/count
// settings) -- split out of LossTab.tsx so it can be reused anywhere an
// item needs editing without dragging in LossTab's much heavier ItemDetail
// (merge/alias-picker/matches/pack-chain history), which isn't relevant
// outside the Loss by Item tab itself.
export const EMPTY_ITEM_EDIT_FORM = {
  item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '',
  unit_time_seconds: '',
  converts_to_item_id: '', count_excluded: false, count_cadence_days: '', count_excluded_reason: '',
  gmc_type: '', product_type: '',
}

// 'compact' is the dense form used inside the Live Sale grid-edit sheet --
// small, but every field carries its own label so it still reads as a
// proper form rather than a bare grid of boxes.
// 'large' is a full-size form for contexts where this is the only thing on
// screen, like Live Sale's sale-tap sheet -- real labels above each field
// instead of relying on placeholder text, and input sizing that matches the
// rest of that sheet (Quantity/Price fields) rather than a table cell.
const SIZES = {
  compact: {
    wrap: 'space-y-1 p-1.5 bg-gray-50 border-b border-gray-200',
    input: 'w-full bg-white border border-gray-300 rounded-md px-1.5 py-1 text-[10px] text-gray-900 outline-none focus:ring-2 focus:ring-blue-400 focus:border-blue-400 transition',
    // Read-only (not editMode) display -- deliberately NOT the same look as
    // `input` above. A field styled like an open text box even while locked
    // reads as editable when it isn't; plain text with no border makes
    // "you have to press Edit first" obvious at a glance instead of just
    // true-but-invisible.
    readOnly: 'truncate text-[10px] text-gray-700 leading-tight py-0.5',
    label: 'text-[7px] font-bold text-gray-500 uppercase tracking-wide block leading-none mb-0.5',
    fieldGap: 'gap-1',
    sectionLabel: 'text-[7px] font-bold text-gray-500 uppercase tracking-wide block',
    sectionWrap: 'pt-1 border-t border-gray-200 space-y-1',
    checkboxLabel: 'flex items-center gap-1 text-[9px] text-gray-700 cursor-pointer select-none',
    checkbox: 'w-3 h-3 accent-red-600',
  },
  large: {
    wrap: 'space-y-4',
    input: 'w-full text-base text-gray-900 bg-gray-50 border border-gray-300 rounded-lg px-3 py-2.5 outline-none focus:ring-1 focus:ring-blue-400',
    readOnly: 'bg-gray-100 rounded px-3 py-2.5 text-base text-gray-900',
    label: 'block text-xs font-semibold text-gray-700 mb-1.5',
    fieldGap: 'gap-3',
    sectionLabel: 'text-xs font-bold text-gray-500 block mb-2',
    sectionWrap: 'pt-4 border-t border-gray-200 space-y-3',
    checkboxLabel: 'flex items-center gap-2 text-sm text-gray-700 cursor-pointer select-none',
    checkbox: 'w-4 h-4 accent-red-600',
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

export function ItemEditForm({ form, onChange, groups, itemId, isService, allItems, size = 'compact', currentCountInterval, currentSoh, onGmcTypeSave, onConversionTargetSave, editMode: controlledEditMode, onEditModeChange, hideEditButton, hideGmcTick }: {
  form: typeof EMPTY_ITEM_EDIT_FORM; onChange: (f: typeof EMPTY_ITEM_EDIT_FORM) => void; groups: string[]
  itemId: number; isService: boolean; allItems: { item_id: number; item_name: string; gmc_type?: string | null }[]
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
  // Called when the user selects a conversion target to save it immediately
  onConversionTargetSave?: (convertToItemId: string | null) => void | Promise<void>
  // Lets a caller that already shows its own Edit toggle for other fields
  // (e.g. the Live Sale grid-edit sheet's Aliases/Services/Merge editor)
  // drive this form's edit mode too, so one button switches both instead of
  // showing two "Edit" buttons for what looks like one item-edit screen.
  // Uncontrolled (internal state) when omitted, same as before.
  editMode?: boolean
  onEditModeChange?: (next: boolean) => void
  hideEditButton?: boolean
  // Hides the GMC Type tick when a caller's own Edit/Save toggle (driven by
  // editMode/onEditModeChange above) already saves this field as part of a
  // full save, making a second, separate "save just this field" button
  // redundant.
  hideGmcTick?: boolean
}) {
  const s = SIZES[size]
  const large = size === 'large'
  const [gmcSaving, setGmcSaving] = useState(false)
  const [gmcSaved, setGmcSaved] = useState(false)
  const [gmcError, setGmcError] = useState('')
  const gmcSavedTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const gmcErrorTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const handleGmcTypeSave = async () => {
    if (!onGmcTypeSave) return
    setGmcSaving(true)
    setGmcError('')
    try {
      await onGmcTypeSave(form.gmc_type)
      setGmcSaved(true)
      if (gmcSavedTimeoutRef.current) clearTimeout(gmcSavedTimeoutRef.current)
      gmcSavedTimeoutRef.current = setTimeout(() => setGmcSaved(false), 2000)
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to save GMC type'
      setGmcError(message)
      if (gmcErrorTimeoutRef.current) clearTimeout(gmcErrorTimeoutRef.current)
      gmcErrorTimeoutRef.current = setTimeout(() => setGmcError(''), 3000)
    } finally {
      setGmcSaving(false)
    }
  }

  useEffect(() => {
    return () => {
      if (gmcSavedTimeoutRef.current) clearTimeout(gmcSavedTimeoutRef.current)
      if (gmcErrorTimeoutRef.current) clearTimeout(gmcErrorTimeoutRef.current)
    }
  }, [])

  const set = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    onChange({ ...form, [k]: e.target.value })
  const setCheckbox = (k: keyof typeof EMPTY_ITEM_EDIT_FORM) => (e: React.ChangeEvent<HTMLInputElement>) =>
    onChange({ ...form, [k]: e.target.checked })
  const gmcOptions = [
    { value: '', label: '— None —' },
    { value: 'gmc', label: 'GMC only, no service' },
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
  const [internalEditMode, setInternalEditMode] = useState(false)
  const editMode = controlledEditMode ?? internalEditMode
  const setEditMode = (next: boolean) => {
    if (onEditModeChange) onEditModeChange(next)
    else setInternalEditMode(next)
  }
  return (
    <div className={s.wrap}>
      <div className={`flex items-start justify-between gap-3 ${large ? 'mb-4' : ''}`}>
      <div className={large ? 'grid grid-cols-3 gap-3 flex-1' : `grid grid-cols-4 ${s.fieldGap} flex-1`}>
        {/* Item name isn't a field in this grid -- the grid-edit sheet
            renames it inline via its own red title bar instead (see
            item/page.tsx), so there's no separate "Item name" box
            duplicating what's already shown right above this form. */}
        <div>
          <label className={s.label}>Group</label>
          {editMode ? (
            <>
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
                  className={s.input + ' mt-2'} />
              )}
            </>
          ) : (
            <div className={s.readOnly}>
              {form.cf_group || '—'}
            </div>
          )}
        </div>
        <div>
          <label className={s.label}>Type</label>
          {editMode ? (
            <select value={form.product_type} onChange={set('product_type')} className={s.input}>
              <option value="">— Select type —</option>
              <option value="goods">Good</option>
              <option value="service">Service</option>
            </select>
          ) : (
            <div className={s.readOnly}>
              {form.product_type === 'goods' ? 'Good' : form.product_type === 'service' ? 'Service' : '—'}
            </div>
          )}
        </div>
        <div>
          <label className={s.label}>Selling price</label>
          {editMode ? (
            <input placeholder="SP" type="number" value={form.selling_rate} onChange={set('selling_rate')} className={s.input} />
          ) : (
            <div className={s.readOnly}>
              {form.selling_rate ? trimZeros(form.selling_rate) : '—'}
            </div>
          )}
        </div>
        <div>
          {/* VCP (Vendor Cost Price) is no longer manually typed here -- it
              syncs automatically from the item's most recent real bill (see
              lib/vcpSync.ts), so this field is always read-only regardless
              of editMode. */}
          <label className={s.label}>Cost price (VCP)</label>
          <div className={s.readOnly} title="Synced from the item's most recent bill -- add or edit a bill to change it">
            {form.purchase_rate ? trimZeros(form.purchase_rate) : '—'}
          </div>
        </div>
        <div>
          <label className={s.label}>Units per pack</label>
          {editMode ? (
            <input placeholder="Units/pack" type="number" value={form.units_per_pack} onChange={set('units_per_pack')} className={s.input} />
          ) : (
            <div className={s.readOnly}>
              {form.units_per_pack ? trimZeros(form.units_per_pack) : '—'}
            </div>
          )}
        </div>
        <div>
          <label className={s.label}>Unit name</label>
          {editMode ? (
            <input placeholder="Unit" value={form.unit_name} onChange={set('unit_name')} className={s.input} />
          ) : (
            <div className={s.readOnly}>
              {form.unit_name || '—'}
            </div>
          )}
        </div>
        <div>
          <label className={s.label}>Time/unit</label>
          {editMode ? (
            <div className="flex items-center gap-1">
              <input
                type="number" min="0" placeholder="Min"
                value={form.unit_time_seconds ? Math.floor(parseInt(form.unit_time_seconds, 10) / 60) : ''}
                onChange={e => {
                  const min = Math.max(0, parseInt(e.target.value, 10) || 0)
                  const sec = form.unit_time_seconds ? parseInt(form.unit_time_seconds, 10) % 60 : 0
                  onChange({ ...form, unit_time_seconds: String(min * 60 + sec) })
                }}
                className={s.input}
              />
              <span className="text-gray-400">:</span>
              <input
                type="number" min="0" max="59" placeholder="Sec"
                value={form.unit_time_seconds ? parseInt(form.unit_time_seconds, 10) % 60 : ''}
                onChange={e => {
                  const min = form.unit_time_seconds ? Math.floor(parseInt(form.unit_time_seconds, 10) / 60) : 0
                  const sec = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0))
                  onChange({ ...form, unit_time_seconds: String(min * 60 + sec) })
                }}
                className={s.input}
              />
            </div>
          ) : (
            <div className={s.readOnly}>
              {form.unit_time_seconds ? formatDuration(parseInt(form.unit_time_seconds, 10)) : '—'}
            </div>
          )}
        </div>
        <div>
          <label className={s.label}>GMC Type</label>
          {editMode ? (
            <div className="flex items-center gap-1">
              <select value={form.gmc_type} onChange={set('gmc_type')} className={s.input}>
                {gmcOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
              {onGmcTypeSave && !hideGmcTick && (
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
          ) : (
            <div className={s.readOnly}>
              {gmcOptions.find(o => o.value === form.gmc_type)?.label ?? '—'}
            </div>
          )}
          {gmcError && (
            <div className={`mt-1 ${large ? 'text-sm' : 'text-[9px]'} text-red-600 font-semibold`}>
              ✗ {gmcError}
            </div>
          )}
          {gmcSaved && (
            <div className={`mt-1 ${large ? 'text-sm' : 'text-[9px]'} text-green-600 font-semibold`}>
              ✓ GMC Type saved
            </div>
          )}
        </div>
        {(form.gmc_type === 'service_using_gmc' || form.gmc_type === 'pack_to_gmc') && (
          <div>
            <label className={`${s.label} ${form.gmc_type === 'service_using_gmc' && !form.converts_to_item_id ? 'text-red-600' : ''}`}>
              {form.gmc_type === 'pack_to_gmc'
                ? 'Credit units/pack into'
                : 'Uses this GMC'}
              {form.gmc_type === 'service_using_gmc' && <span className="text-red-600">*</span>}
            </label>
            {editMode ? (
              <select
                value={form.converts_to_item_id}
                onChange={(e) => {
                  const value = e.target.value
                  onChange({ ...form, converts_to_item_id: value })
                  // Auto-save the selection
                  if (onConversionTargetSave) {
                    onConversionTargetSave(value || null)
                  }
                }}
                className={`${s.input} ${form.gmc_type === 'service_using_gmc' && !form.converts_to_item_id ? 'border-red-500 bg-red-50' : ''}`}>
                <option value="">{form.gmc_type === 'service_using_gmc' ? '⚠ Required — Choose an item' : '— No conversion —'}</option>
                {allItems.filter(i => {
                  if (i.item_id === itemId) return false
                  if (!['gmc', 'service_no_gmc'].includes(i.gmc_type || '')) return false
                  return true
                }).map(i => (
                  <option key={i.item_id} value={String(i.item_id)}>{i.item_name}</option>
                ))}
              </select>
            ) : (
              <div className={s.readOnly}>
                {allItems.find(i => String(i.item_id) === form.converts_to_item_id)?.item_name ?? '—'}
              </div>
            )}
          </div>
        )}
      </div>
      {!hideEditButton && (
        <button
          onClick={() => setEditMode(!editMode)}
          className={`shrink-0 ${editMode ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-blue-600 hover:bg-blue-500 text-white'} font-semibold rounded transition ${large ? 'px-3 py-2 text-sm mt-7' : 'px-1.5 py-0.5 text-[9px] mt-0.5'}`}>
          {editMode ? '✓ Done' : '✎ Edit'}
        </button>
      )}
    </div>
      {!isService && (
        <div className={s.sectionWrap}>
          <label className={s.sectionLabel}>Stock counts</label>
          {currentCountInterval && (
            <p className={large ? 'text-xs text-gray-500' : 'text-[8px] text-gray-500 leading-tight'}>
              Currently: <span className="font-semibold text-gray-700">{currentCountInterval}</span>
              {!form.count_excluded && !form.count_cadence_days && currentCountInterval !== 'Daily' && (
                <> (automatic)</>
              )}
            </p>
          )}
          {editMode && (
            <div className={large ? 'space-y-3 pt-1' : 'space-y-1 pt-0.5'}>
              <label className={s.checkboxLabel}>
                <input type="checkbox" checked={form.count_excluded}
                  onChange={e => onChange({ ...form, count_excluded: e.target.checked, count_excluded_reason: e.target.checked ? form.count_excluded_reason : '' })}
                  className={s.checkbox} />
                Exclude from counts entirely
              </label>
              {!form.count_excluded ? (
                <div>
                  <label className={s.label}>Count every</label>
                  <select
                    value={customCadence ? '__custom__' : form.count_cadence_days}
                    onChange={e => {
                      if (e.target.value === '__custom__') { setCustomCadence(true); onChange({ ...form, count_cadence_days: '' }) }
                      else { setCustomCadence(false); onChange({ ...form, count_cadence_days: e.target.value }) }
                    }}
                    className={s.input}>
                    <option value="">Automatic (based on item history)</option>
                    {CADENCE_PRESETS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                    <option value="__custom__">Other…</option>
                  </select>
                  {customCadence && (
                    <input type="number" min="1" step="1" placeholder="Number of days" value={form.count_cadence_days}
                      onChange={set('count_cadence_days')} className={s.input + ' mt-2'} />
                  )}
                </div>
              ) : (
                <div>
                  <label className={s.label}>Why is it being excluded?</label>
                  {stockBlocksExclude && (
                    <p className={(large ? 'text-xs' : 'text-[8px]') + ' text-red-600 font-semibold mb-0.5'}>
                      Still shows {currentSoh} in stock -- bring it to 0 first.
                    </p>
                  )}
                  {currentSoh === 0 && (
                    <p className={(large ? 'text-xs' : 'text-[8px]') + ' text-green-600 mb-0.5'}>Stock is 0 -- ready to exclude.</p>
                  )}
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
                      placeholder="Describe the reason" className={s.input + ' mt-2'} />
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
