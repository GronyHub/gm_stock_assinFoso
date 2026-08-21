'use client'
import { useState, useEffect, useMemo } from 'react'
import { usePolling } from '@/lib/usePolling'
import PageLawsList from './PageLawsList'
import LawsToggleBar from './LawsToggleBar'
import { useLawsPanel } from './useLawsPanel'

type Property = {
  id: number
  expense_date: string
  expense_account: string
  description: string | null
  vendor_name: string | null
  amount: string | null
  is_property: boolean
  availability: string | null
  working: string | null
  location: string | null
  not_working_reason: string | null
  not_available_reason: string | null
}

type PropertyFields = Pick<Property, 'availability' | 'working' | 'location' | 'not_working_reason' | 'not_available_reason'>

const PROPERTY_LOCATIONS = Array.from({ length: 10 }, (_, i) => `Grony ${i + 1}`)
const NOT_WORKING_REASONS = ['Faulty - Needs Repair', 'Condemned - Beyond Repairs']
const NOT_AVAILABLE_REASONS = ['Spoilt and thrown away', 'Stolen', "At Grony's House"]

const MONTHS = ['Ja','Fe','Mr','Ap','My','Ju','Jl','Au','Se','Oc','No','De']
const DAYS   = ['Su','Mo','Tu','We','Th','Fr','Sa']

function fmtShort(dateStr: string) {
  const d = new Date(dateStr)
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${String(d.getUTCFullYear()).slice(-2)}-${DAYS[d.getUTCDay()]}`
}

function fmt(val: string | null) {
  if (val == null) return '—'
  const n = parseFloat(val)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 0 })
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1 text-[10px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

type PropTab = 'all' | 'available' | 'away'

// The Props/Available/Not Available views used to live inside Expenses'
// own toolbar and edit form -- moved here so they get their own dedicated
// page (and the huge availability/working/location cascade stops crowding
// Expenses' edit panel for entries that were never a property).
// `initialTab` is driven by the left pane's own "Properties at Shop"/
// "Properties not at Shop" rows (see item/page.tsx) -- landing here from
// either seeds straight into that tab instead of always opening on "All".
export default function PropertiesPage({ initialTab }: { initialTab?: PropTab | null } = {}) {
  const [properties, setProperties] = useState<Property[]>([])
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<PropTab>(initialTab ?? 'all')
  const [search, setSearch] = useState('')
  const lawsPanel = useLawsPanel('showPropertiesLaws')

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  function load() {
    fetch('/api/expenses')
      .then(r => r.json())
      .then((data: unknown) => {
        setProperties(Array.isArray(data) ? (data as Property[]).filter(e => e.is_property) : [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])
  usePolling(load, 120000)

  const filtered = useMemo(() => {
    let list = properties
    if (tab === 'available') list = list.filter(p => p.availability === 'available')
    if (tab === 'away')      list = list.filter(p => p.availability === 'not_available')
    const q = search.toLowerCase()
    if (!q) return list
    return list.filter(p =>
      p.expense_account.toLowerCase().includes(q) ||
      (p.description ?? '').toLowerCase().includes(q) ||
      (p.vendor_name ?? '').toLowerCase().includes(q) ||
      (p.location ?? '').toLowerCase().includes(q)
    )
  }, [properties, tab, search])

  const counts = useMemo(() => ({
    all: properties.length,
    available: properties.filter(p => p.availability === 'available').length,
    away: properties.filter(p => p.availability === 'not_available').length,
  }), [properties])

  const propertiesWithoutLocation = useMemo(() =>
    properties.filter(p => p.availability === 'available' && !p.location),
    [properties]
  )

  async function patchPropertyFields(property: Property, updates: Partial<PropertyFields>) {
    const merged: PropertyFields = {
      availability: property.availability, working: property.working, location: property.location,
      not_working_reason: property.not_working_reason, not_available_reason: property.not_available_reason,
      ...updates,
    }
    const res = await fetch(`/api/expenses/${property.id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        availability: merged.availability, working: merged.working, location: merged.location,
        notWorkingReason: merged.not_working_reason, notAvailableReason: merged.not_available_reason,
      }),
    })
    if (res.ok) setProperties(prev => prev.map(p => p.id === property.id ? { ...p, ...merged } : p))
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  const tabs: { key: PropTab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: counts.all },
    { key: 'available', label: 'Available', count: counts.available },
    { key: 'away', label: 'Not Available', count: counts.away },
  ]

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="px-2 pt-2 shrink-0 flex flex-nowrap items-center gap-1.5 overflow-x-auto">
        <LawsToggleBar show={lawsPanel.show} setShow={lawsPanel.setShow}
          openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
          hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}
          activeFilters={lawsPanel.activeFilters} toggleFilter={lawsPanel.toggleFilter} dark={false} />
      </div>
      {lawsPanel.show && (
        <div className="px-2 shrink-0 space-y-2">
          {propertiesWithoutLocation.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-xl p-2">
              <p className="text-[9px] font-bold text-red-700">
                ⚠ {propertiesWithoutLocation.length} available {propertiesWithoutLocation.length === 1 ? 'property' : 'properties'} without location assigned
              </p>
            </div>
          )}
          <div className="border border-gray-200 rounded-xl bg-white overflow-hidden">
            <PageLawsList scopeKey="Properties" isItemsLaws={true} onChange={lawsPanel.bumpRefresh}
              openForm={lawsPanel.openForm} setOpenForm={lawsPanel.setOpenForm}
              hideZeroFlags={lawsPanel.hideZeroFlags} setHideZeroFlags={lawsPanel.setHideZeroFlags}

              activeFilters={lawsPanel.activeFilters} />
          </div>
        </div>
      )}
      <div className="flex items-center gap-1.5 px-2 py-1 border-b border-gray-200 bg-gray-50 shrink-0 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`text-[9px] font-semibold px-1.5 py-0.5 rounded transition
              ${tab === t.key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t.label} ({t.count})
          </button>
        ))}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search…"
          className="text-[10px] bg-white border border-gray-200 rounded px-2 py-1 outline-none w-32" />
      </div>
      <div className="flex-1 overflow-y-auto min-h-0 p-2 space-y-2">
        {filtered.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-10">No properties classified yet -- mark an expense as a Property from its Edit form on the Expenses page.</p>
        ) : filtered.map(p => (
          <div key={p.id} className="bg-white border border-gray-200 rounded-xl p-3 space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-xs font-bold text-gray-900 truncate">{p.expense_account}</p>
                <p className="text-[9px] text-gray-400">{fmtShort(p.expense_date)} · ₵{fmt(p.amount)}{p.vendor_name ? ` · ${p.vendor_name}` : ''}</p>
              </div>
              {p.description && <p className="text-[10px] text-gray-500 truncate max-w-[40%]">{p.description}</p>}
            </div>

            <div>
              <p className="text-[9px] text-gray-400 mb-0.5">Availability</p>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name={`availability-${p.id}`} checked={p.availability === 'available'}
                    onChange={() => patchPropertyFields(p, { availability: 'available', working: null, location: null, not_working_reason: null, not_available_reason: null })}
                    className="w-3 h-3 accent-blue-600" />
                  <span className="text-[10px] text-gray-700">Available</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" name={`availability-${p.id}`} checked={p.availability === 'not_available'}
                    onChange={() => patchPropertyFields(p, { availability: 'not_available', working: null, location: null, not_working_reason: null, not_available_reason: null })}
                    className="w-3 h-3 accent-blue-600" />
                  <span className="text-[10px] text-gray-700">Not Available</span>
                </label>
              </div>
            </div>

            {p.availability === 'available' && (
              <>
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Condition</p>
                  <div className="flex items-center gap-3">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={`working-${p.id}`} checked={p.working === 'working'}
                        onChange={() => patchPropertyFields(p, { working: 'working', not_working_reason: null })}
                        className="w-3 h-3 accent-blue-600" />
                      <span className="text-[10px] text-gray-700">Working</span>
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="radio" name={`working-${p.id}`} checked={p.working === 'not_working'}
                        onChange={() => patchPropertyFields(p, { working: 'not_working' })}
                        className="w-3 h-3 accent-blue-600" />
                      <span className="text-[10px] text-gray-700">Not Working</span>
                    </label>
                  </div>
                </div>
                <div>
                  <p className="text-[9px] text-gray-400 mb-0.5">Location</p>
                  <select value={p.location ?? ''} onChange={ev => patchPropertyFields(p, { location: ev.target.value })}
                    className={`${inputCls} w-auto`}>
                    <option value="" disabled>Select…</option>
                    {PROPERTY_LOCATIONS.map(loc => <option key={loc} value={loc}>{loc}</option>)}
                  </select>
                </div>
                {p.working === 'not_working' && (
                  <div>
                    <p className="text-[9px] text-gray-400 mb-0.5">Reason</p>
                    <select value={p.not_working_reason ?? ''} onChange={ev => patchPropertyFields(p, { not_working_reason: ev.target.value })}
                      className={`${inputCls} w-auto`}>
                      <option value="" disabled>Select…</option>
                      {NOT_WORKING_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </div>
                )}
              </>
            )}

            {p.availability === 'not_available' && (
              <div>
                <p className="text-[9px] text-gray-400 mb-0.5">Reason / Location</p>
                <select value={p.not_available_reason ?? ''} onChange={ev => patchPropertyFields(p, { not_available_reason: ev.target.value })}
                  className={`${inputCls} w-auto`}>
                  <option value="" disabled>Select…</option>
                  {NOT_AVAILABLE_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
