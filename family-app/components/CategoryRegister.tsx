'use client'

import { useState } from 'react'
import type { LandEntry } from '@/lib/types'
import { useLocalStorageEntries } from '@/lib/useLocalStorageEntries'

const EMPTY_FORM = { name: '', size: '', location: '', notes: '' }

export default function CategoryRegister({
  category,
  storageKey,
}: {
  category: string
  storageKey: string
}) {
  const [entries, setEntries] = useLocalStorageEntries(`family-register:${storageKey}`)
  const [form, setForm] = useState(EMPTY_FORM)
  const [editingId, setEditingId] = useState<string | null>(null)

  function resetForm() {
    setForm(EMPTY_FORM)
    setEditingId(null)
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.name.trim()) return

    setEntries(
      editingId
        ? entries.map((entry) => (entry.id === editingId ? { ...entry, ...form } : entry))
        : [...entries, { id: crypto.randomUUID(), ...form }]
    )
    resetForm()
  }

  function handleEdit(entry: LandEntry) {
    setEditingId(entry.id)
    setForm({ name: entry.name, size: entry.size, location: entry.location, notes: entry.notes })
  }

  function handleDelete(id: string) {
    setEntries(entries.filter((entry) => entry.id !== id))
    if (editingId === id) resetForm()
  }

  return (
    <div className="max-w-3xl mx-auto w-full px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-semibold">{category}</h1>
        <p className="text-sm text-zinc-500">Land and asset register for {category}</p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-1 sm:grid-cols-2 gap-3 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4"
      >
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          placeholder="Name / plot"
          required
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        <input
          value={form.size}
          onChange={(e) => setForm({ ...form, size: e.target.value })}
          placeholder="Size (e.g. 2 acres)"
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        <input
          value={form.location}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="Location"
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        <input
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Notes"
          className="border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm bg-transparent"
        />
        <div className="sm:col-span-2 flex gap-2">
          <button
            type="submit"
            className="bg-black text-white dark:bg-white dark:text-black rounded-lg px-4 py-2 text-sm font-medium"
          >
            {editingId ? 'Save changes' : 'Add entry'}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg px-4 py-2 text-sm font-medium border border-zinc-300 dark:border-zinc-700"
            >
              Cancel
            </button>
          )}
        </div>
      </form>

      <ul className="space-y-2">
        {entries.length === 0 && (
          <li className="text-sm text-zinc-500 py-6 text-center">No entries yet.</li>
        )}
        {entries.map((entry) => (
          <li
            key={entry.id}
            className="border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-start justify-between gap-4"
          >
            <div>
              <p className="font-medium">{entry.name}</p>
              <p className="text-sm text-zinc-500">
                {[entry.size, entry.location].filter(Boolean).join(' · ') || '—'}
              </p>
              {entry.notes && <p className="text-sm text-zinc-500 mt-1">{entry.notes}</p>}
            </div>
            <div className="flex gap-2 shrink-0">
              <button
                onClick={() => handleEdit(entry)}
                className="text-sm text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100"
              >
                Edit
              </button>
              <button
                onClick={() => handleDelete(entry.id)}
                className="text-sm text-red-500 hover:text-red-700"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
