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

export default function GmcPacksPage() {
  const [packs, setPacks] = useState<GmcPack[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchPacks = async () => {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch('/api/gmc-packs')
        if (!res.ok) {
          throw new Error(`Failed to fetch GMC packs: ${res.status}`)
        }
        const data = await res.json()
        setPacks(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchPacks()
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
    pack_to_gmc: 'Pack → GMC',
    service_using_gmc: 'Service uses GMC',
  }

  return (
    <div className="overflow-x-auto p-4">
      <table className="w-full border-collapse">
        <thead>
          <tr className="border-b-2 border-gray-300 bg-gray-50">
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
              Source Item / Service
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
              GMC Type
            </th>
            <th className="border border-gray-200 px-4 py-2 text-left font-semibold text-gray-700">
              Target Item / Service
            </th>
            <th className="border border-gray-200 px-4 py-2 text-center font-semibold text-gray-700">
              Units/Pack
            </th>
          </tr>
        </thead>
        <tbody>
          {packs.map((pack) => (
            <tr key={pack.id} className="hover:bg-blue-50">
              <td className="border border-gray-200 px-4 py-2 text-gray-900">
                {pack.item_name}
              </td>
              <td className="border border-gray-200 px-4 py-2">
                <span className="inline-block rounded bg-blue-100 px-2 py-1 text-sm font-medium text-blue-800">
                  {gmcTypeLabels[pack.gmc_type] || pack.gmc_type}
                </span>
              </td>
              <td className="border border-gray-200 px-4 py-2 text-gray-900">
                {pack.converts_to_name || '(unresolved)'}
              </td>
              <td className="border border-gray-200 px-4 py-2 text-center text-gray-900">
                {pack.units_per_pack !== null ? pack.units_per_pack : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
