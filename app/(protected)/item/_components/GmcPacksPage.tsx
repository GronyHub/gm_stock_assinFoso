'use client'

import { useEffect, useState } from 'react'

interface GmcPack {
  id: string
  item_name: string
  gmc_type: string
  product_type: string
  units_per_pack: number | null
  converts_to_item_id: string
  converts_to_name: string | null
}

interface AllItem {
  id: number
  name: string
  gmc_type?: string
  product_type?: string
}

export default function GmcPacksPage() {
  const [packs, setPacks] = useState<GmcPack[]>([])
  const [allItems, setAllItems] = useState<AllItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Form state
  const [sourceItemId, setSourceItemId] = useState<number | null>(null)
  const [gmcType, setGmcType] = useState('')
  const [targetItemId, setTargetItemId] = useState<number | null>(null)
  const [unitsPack, setUnitsPack] = useState('')

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true)
        setError(null)
        const [packsRes, itemsRes] = await Promise.all([
          fetch('/api/gmc-packs'),
          fetch('/api/items/all')
        ])
        if (!packsRes.ok || !itemsRes.ok) {
          throw new Error('Failed to fetch data')
        }
        const packsData = await packsRes.json()
        const itemsData = await itemsRes.json()
        setPacks(packsData)
        setAllItems(itemsData)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  if (loading) {
    return <div className="p-4 text-gray-500">Loading GMC packs...</div>
  }

  if (error) {
    return <div className="p-4 text-red-600">Error: {error}</div>
  }

  if (packs.length === 0) {
    return <div className="p-4 text-gray-500">No GMC packs configured yet.</div>
  }

  const gmcTypeLabels: Record<string, string> = {
    gmc: 'GMC only, no service',
    service_gmc: 'Is both service and GMC alone',
    service_gmc_serving: 'Is Service and GMC serving other services',
    pack_to_gmc: 'Pack → GMC',
    service_using_gmc: 'Service uses GMC',
  }

  // Group by target item, separating pack_to_gmc from service_using_gmc
  const groupedByTarget = packs.reduce((acc, pack) => {
    const targetKey = `${pack.converts_to_item_id}-${pack.converts_to_name}`
    if (!acc[targetKey]) {
      acc[targetKey] = {
        target_id: pack.converts_to_item_id,
        target_name: pack.converts_to_name,
        packToGmc: [],
        serviceUsingGmc: []
      }
    }
    const source = {
      item_name: pack.item_name,
      gmc_type: pack.gmc_type,
      units_per_pack: pack.units_per_pack,
      product_type: pack.product_type
    }
    if (pack.gmc_type === 'pack_to_gmc') {
      acc[targetKey].packToGmc.push(source)
    } else if (pack.gmc_type === 'service_using_gmc') {
      acc[targetKey].serviceUsingGmc.push(source)
    }
    return acc
  }, {} as Record<string, any>)

  const groupedRows = Object.values(groupedByTarget)

  const sourceItem = sourceItemId ? allItems.find(i => i.id === sourceItemId) : null
  const targetItem = targetItemId ? allItems.find(i => i.id === targetItemId) : null
  const isComplete = sourceItemId && gmcType && targetItemId && unitsPack

  return (
    <div className="w-full h-full overflow-x-auto overflow-y-auto p-4 flex flex-col gap-4">
      {/* Configuration Form */}
      <div className="bg-white rounded-lg border border-gray-300 p-4">
        <h3 className="text-lg font-bold text-gray-900 mb-4">Create GMC Pack Configuration</h3>

        {/* Live Feedback Summary */}
        <div className={`mb-4 p-3 rounded-lg border-2 ${
          isComplete ? 'border-green-400 bg-green-50' : 'border-gray-300 bg-gray-50'
        }`}>
          <div className="text-sm font-semibold text-gray-700 mb-2">Configuration Summary:</div>
          <div className="space-y-1 text-sm">
            <div className={sourceItemId ? 'text-green-700' : 'text-gray-500'}>
              📦 Source: {sourceItem?.name || '(Select an item)'}
            </div>
            <div className={gmcType ? 'text-green-700' : 'text-gray-500'}>
              🏷️ Type: {gmcType ? gmcTypeLabels[gmcType] || gmcType : '(Select a type)'}
            </div>
            <div className={targetItemId ? 'text-green-700' : 'text-gray-500'}>
              🎯 Target: {targetItem?.name || '(Select target item)'}
            </div>
            <div className={unitsPack ? 'text-green-700' : 'text-gray-500'}>
              📊 Units/Pack: {unitsPack || '(Enter quantity)'}
            </div>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="grid grid-cols-2 gap-4 mb-4">
          {/* Source Item */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Source Item</label>
            <select
              value={sourceItemId || ''}
              onChange={e => setSourceItemId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">Select item...</option>
              {allItems.map(item => (
                <option key={item.id} value={item.id}>{item.name}</option>
              ))}
            </select>
          </div>

          {/* GMC Type */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">GMC Type</label>
            <select
              value={gmcType}
              onChange={e => setGmcType(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">Select type...</option>
              <option value="pack_to_gmc">Pack → GMC</option>
              <option value="service_using_gmc">Service uses GMC</option>
            </select>
          </div>

          {/* Target Item */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Target Item</label>
            <select
              value={targetItemId || ''}
              onChange={e => setTargetItemId(e.target.value ? Number(e.target.value) : null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            >
              <option value="">Select item...</option>
              {allItems
                .filter(i => i.id !== sourceItemId && ['gmc', 'service_gmc', 'service_gmc_serving'].includes(i.gmc_type || ''))
                .map(item => (
                  <option key={item.id} value={item.id}>{item.name}</option>
                ))}
            </select>
          </div>

          {/* Units Per Pack */}
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">Units/Pack</label>
            <input
              type="number"
              value={unitsPack}
              onChange={e => setUnitsPack(e.target.value)}
              placeholder="0.0000"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-400 focus:border-transparent"
            />
          </div>
        </div>

        <button
          disabled={!isComplete}
          className={`w-full py-2 rounded-lg font-semibold transition ${
            isComplete
              ? 'bg-green-600 text-white hover:bg-green-700'
              : 'bg-gray-300 text-gray-500 cursor-not-allowed'
          }`}
        >
          {isComplete ? '✓ Save Configuration' : '⚠ Complete all fields'}
        </button>
      </div>

      {/* Existing Packs Table */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Configured GMC Packs</h3>
        <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
              Pack → GMC
            </th>
            <th className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-700">
              Target Item / Service
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
              Service Uses GMC
            </th>
          </tr>
        </thead>
        <tbody>
          {groupedRows.map((row: any, idx: number) => (
            <tr key={idx} className="hover:bg-blue-50">
              <td className="border border-gray-200 px-4 py-2">
                <div className="space-y-2">
                  {row.packToGmc.length > 0 ? (
                    row.packToGmc.map((source: any, sourceIdx: number) => (
                      <div key={sourceIdx} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-900">{source.item_name}</span>
                        {source.units_per_pack && (
                          <span className="text-gray-600 text-xs">
                            ({source.units_per_pack} units)
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs italic">—</span>
                  )}
                </div>
              </td>
              <td className="border border-gray-200 px-4 py-2 text-center text-gray-900 font-semibold">
                {row.target_name || '(unresolved)'}
              </td>
              <td className="border border-gray-200 px-4 py-2">
                <div className="space-y-2">
                  {row.serviceUsingGmc.length > 0 ? (
                    row.serviceUsingGmc.map((source: any, sourceIdx: number) => (
                      <div key={sourceIdx} className="flex items-center gap-2 text-sm">
                        <span className="text-gray-900">{source.item_name}</span>
                        {source.units_per_pack && (
                          <span className="text-gray-600 text-xs">
                            ({source.units_per_pack} units)
                          </span>
                        )}
                      </div>
                    ))
                  ) : (
                    <span className="text-gray-400 text-xs italic">—</span>
                  )}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
        </div>
      </div>
    </div>
  )
}
