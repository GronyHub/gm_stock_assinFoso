'use client'
import { useState, useEffect, useMemo } from 'react'

type Location = string

export default function LocationsPage() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [newLocation, setNewLocation] = useState('')
  const [adding, setAdding] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchLocations()
  }, [])

  async function fetchLocations() {
    try {
      const res = await fetch('/api/locations')
      const data = await res.json()
      setLocations(Array.isArray(data) ? data.sort() : [])
      setLoading(false)
    } catch (err) {
      setLoading(false)
    }
  }

  async function addLocation() {
    const name = newLocation.trim()
    if (!name) return

    if (locations.includes(name)) {
      setError('This location already exists.')
      return
    }

    setAdding(true)
    setError(null)

    try {
      const res = await fetch('/api/locations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: name }),
      })

      if (res.ok) {
        setLocations(prev => [...prev, name].sort())
        setNewLocation('')
      } else {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'Could not add location.')
      }
    } catch (err) {
      setError('Failed to add location.')
    } finally {
      setAdding(false)
    }
  }

  const filtered = useMemo(() => {
    if (!search.trim()) return locations
    const q = search.toLowerCase()
    return locations.filter(l => l.toLowerCase().includes(q))
  }, [locations, search])

  if (loading) return <div className="py-16 text-center text-gray-400">Loading…</div>

  return (
    <div className="space-y-4 pb-10">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-gray-900">Locations</h1>
        <span className="text-xs text-gray-400">{locations.length} locations</span>
      </div>

      {/* Add new location */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
        <p className="font-bold text-gray-900">Add Location</p>
        <div>
          <input
            value={newLocation}
            onChange={e => setNewLocation(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addLocation()}
            placeholder="e.g. Accra, Kumasi, Cape Coast"
            className="w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400"
          />
        </div>
        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}
        <button
          onClick={addLocation}
          disabled={adding || !newLocation.trim()}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-semibold rounded-lg py-2.5 transition">
          {adding ? 'Adding…' : 'Add Location'}
        </button>
      </div>

      {/* Search locations */}
      <input
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search locations…"
        className="w-full bg-gray-100 border border-gray-200 rounded-lg px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-400"
      />

      {/* Locations list */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <p className="py-10 text-center text-gray-400 text-sm">No locations found.</p>
        ) : (
          <div className="divide-y divide-gray-100">
            {filtered.map(location => (
              <div
                key={location}
                className="px-4 py-3 text-sm text-gray-900 hover:bg-blue-50 transition">
                {location}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
