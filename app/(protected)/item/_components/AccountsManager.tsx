'use client'
import { useState, useEffect } from 'react'

type Account = { id: number; name: string }

export default function AccountsManager({ onClose, onAccountCreated }: { onClose: () => void; onAccountCreated?: () => void }) {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [newAccountName, setNewAccountName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    fetchAccounts()
  }, [])

  async function fetchAccounts() {
    try {
      const res = await fetch('/api/accounts')
      if (res.ok) {
        const data = await res.json()
        setAccounts(data)
      }
    } catch (e) {
      console.error('Failed to fetch accounts:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleCreateAccount() {
    if (!newAccountName.trim()) {
      setError('Account name cannot be empty')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newAccountName.trim() }),
      })

      if (res.ok) {
        const account = await res.json()
        setAccounts(prev => [...prev, account].sort((a, b) => a.name.localeCompare(b.name)))
        setNewAccountName('')
        onAccountCreated?.()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to create account')
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleRenameAccount() {
    if (!editingId || !editingName.trim()) {
      setError('Account name cannot be empty')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editingName.trim() }),
      })

      if (res.ok) {
        const updated = await res.json()
        setAccounts(prev => prev.map(a => a.id === editingId ? updated : a).sort((a, b) => a.name.localeCompare(b.name)))
        setEditingId(null)
        setEditingName('')
        onAccountCreated?.()
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to rename account')
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteAccount(id: number) {
    if (!confirm('Delete this account?')) return

    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })

      if (res.ok) {
        setAccounts(prev => prev.filter(a => a.id !== id))
      } else {
        const data = await res.json()
        setError(data.error || 'Failed to delete account')
      }
    } catch (e) {
      setError(`Error: ${e instanceof Error ? e.message : String(e)}`)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-2 max-h-[80vh] flex flex-col">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Manage Accounts</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg">×</button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {error && (
            <div className="p-2 bg-red-50 border border-red-200 rounded text-[11px] text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-[10px] font-semibold text-gray-600">Create New Account</p>
            <div className="flex gap-1">
              <input
                type="text"
                value={newAccountName}
                onChange={e => setNewAccountName(e.target.value)}
                onKeyPress={e => e.key === 'Enter' && handleCreateAccount()}
                placeholder="Account name…"
                className="flex-1 text-[11px] px-2 py-1.5 border border-gray-200 rounded bg-gray-50 focus:bg-white outline-none focus:ring-1 focus:ring-blue-400"
              />
              <button
                onClick={handleCreateAccount}
                disabled={!newAccountName.trim() || saving}
                className="px-2 py-1.5 bg-blue-600 text-white text-[10px] font-semibold rounded hover:bg-blue-700 disabled:opacity-50"
              >
                Add
              </button>
            </div>
          </div>

          {loading ? (
            <p className="text-[11px] text-gray-400 text-center py-4">Loading accounts…</p>
          ) : accounts.length === 0 ? (
            <p className="text-[11px] text-gray-400 text-center py-4">No accounts yet</p>
          ) : (
            <div className="space-y-1">
              <p className="text-[10px] font-semibold text-gray-600 mb-2">Existing Accounts</p>
              {accounts.map(account => (
                <div key={account.id} className="flex items-center gap-1 p-2 bg-gray-50 rounded hover:bg-gray-100">
                  {editingId === account.id ? (
                    <>
                      <input
                        type="text"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyPress={e => e.key === 'Enter' && handleRenameAccount()}
                        className="flex-1 text-[11px] px-1.5 py-1 border border-blue-300 rounded bg-white outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleRenameAccount}
                        disabled={saving}
                        className="px-1.5 py-1 bg-green-600 text-white text-[9px] font-semibold rounded hover:bg-green-700 disabled:opacity-50"
                      >
                        ✓
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditingName('') }}
                        disabled={saving}
                        className="px-1.5 py-1 bg-gray-300 text-gray-700 text-[9px] font-semibold rounded hover:bg-gray-400 disabled:opacity-50"
                      >
                        ✕
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-[11px] text-gray-900">{account.name}</span>
                      <button
                        onClick={() => { setEditingId(account.id); setEditingName(account.name); setError(null) }}
                        className="px-1.5 py-1 bg-gray-200 text-gray-700 text-[9px] hover:bg-gray-300 rounded"
                      >
                        Rename
                      </button>
                      <button
                        onClick={() => handleDeleteAccount(account.id)}
                        className="px-1.5 py-1 bg-red-100 text-red-700 text-[9px] hover:bg-red-200 rounded"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t border-gray-200 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-[11px] font-semibold text-gray-700 hover:bg-gray-100 rounded"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
