'use client'
import { useState, useEffect } from 'react'
import { usePolling } from '@/lib/usePolling'
import { Linkify } from '@/lib/linkify'

type ExpenseOrder = {
  id: number
  expense_name: string
  vendor_name: string | null
  price: string | null
  notes: string | null
  entered_by: string | null
  created_at: string
}

const inputCls = 'w-full bg-gray-100 border border-gray-200 rounded px-2 py-1.5 text-[11px] text-gray-900 outline-none focus:ring-1 focus:ring-blue-400'

function fmtPrice(v: string | null) {
  if (v == null) return null
  const n = parseFloat(v)
  return isNaN(n) ? null : n.toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })
}

type FormState = { expense_name: string; vendor_name: string; price: string; notes: string }
const EMPTY_FORM: FormState = { expense_name: '', vendor_name: '', price: '', notes: '' }

function OrderForm({ form, setForm, itemNames, vendorNames, listId, onSave, onCancel, saving, saveLabel }: {
  form: FormState; setForm: (f: FormState) => void
  itemNames: string[]; vendorNames: string[]; listId: string
  onSave: () => void; onCancel?: () => void; saving: boolean; saveLabel: string
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-1.5">
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Expense — pick an existing item or type a new one</p>
        <input list={`${listId}-items`} value={form.expense_name}
          onChange={e => setForm({ ...form, expense_name: e.target.value })}
          placeholder="What does the shop want to buy?" className={inputCls} />
        <datalist id={`${listId}-items`}>
          {itemNames.map(n => <option key={n} value={n} />)}
        </datalist>
      </div>
      <div className="grid grid-cols-2 gap-1.5">
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Vendor (optional)</p>
          <input list={`${listId}-vendors`} value={form.vendor_name}
            onChange={e => setForm({ ...form, vendor_name: e.target.value })}
            placeholder="Not decided yet" className={inputCls} />
          <datalist id={`${listId}-vendors`}>
            {vendorNames.map(n => <option key={n} value={n} />)}
          </datalist>
        </div>
        <div>
          <p className="text-[9px] text-gray-400 mb-0.5">Price (₵, optional)</p>
          <input type="number" min="0" step="0.01" inputMode="decimal" value={form.price}
            onChange={e => setForm({ ...form, price: e.target.value })} placeholder="—" className={inputCls} />
        </div>
      </div>
      <div>
        <p className="text-[9px] text-gray-400 mb-0.5">Notes — price comparisons, specs, anything for the decision</p>
        <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
          rows={4} className={`${inputCls} resize-y`} />
      </div>
      <div className="flex items-center gap-1.5">
        <button onClick={onSave} disabled={saving || !form.expense_name.trim()}
          className="flex-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-[10px] font-bold rounded py-1.5 transition">
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} className="px-3 py-1.5 bg-gray-100 text-gray-600 text-[10px] font-semibold rounded">
            Cancel
          </button>
        )}
      </div>
    </div>
  )
}

// A running wishlist of future purchases the shop is still deciding on --
// separate from the real Expenses table since nothing here has been bought
// yet. Expense/Vendor are free text with a datalist of existing items/
// vendors as suggestions (never forced to match one), since what's wanted
// may not exist in either list yet.
export default function ExpenseOrdersPanel() {
  const [orders, setOrders] = useState<ExpenseOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [itemNames, setItemNames] = useState<string[]>([])
  const [vendorNames, setVendorNames] = useState<string[]>([])
  const [form, setForm] = useState<FormState>({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<FormState>({ ...EMPTY_FORM })
  const [editSaving, setEditSaving] = useState(false)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    fetch('/api/expense-orders').then(r => r.ok ? r.json() : []).then(d => { setOrders(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }
  useEffect(() => {
    load()
    fetch('/api/items/all').then(r => r.ok ? r.json() : []).then(d => {
      setItemNames(Array.isArray(d) ? Array.from(new Set(d.map((i: { name: string }) => i.name))).sort() : [])
    }).catch(() => {})
    fetch('/api/vendors').then(r => r.ok ? r.json() : []).then(d => {
      setVendorNames(Array.isArray(d) ? Array.from(new Set(d.map((v: { display_name: string }) => v.display_name).filter(Boolean))).sort() : [])
    }).catch(() => {})
  }, [])
  usePolling(load, 60000, editId === null)

  async function addOrder() {
    if (!form.expense_name.trim()) return
    setSaving(true)
    const res = await fetch('/api/expense-orders', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    setSaving(false)
    if (res.ok) {
      const row: ExpenseOrder = await res.json()
      setOrders(prev => [row, ...prev])
      setForm({ ...EMPTY_FORM })
    }
  }

  function openEdit(o: ExpenseOrder) {
    setEditId(o.id)
    setEditForm({ expense_name: o.expense_name, vendor_name: o.vendor_name ?? '', price: o.price ?? '', notes: o.notes ?? '' })
    setConfirmDeleteId(null)
  }

  async function saveEdit() {
    if (!editId || !editForm.expense_name.trim()) return
    setEditSaving(true)
    const res = await fetch(`/api/expense-orders/${editId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editForm),
    })
    setEditSaving(false)
    if (res.ok) {
      const row: ExpenseOrder = await res.json()
      setOrders(prev => prev.map(o => o.id === editId ? row : o))
      setEditId(null)
    }
  }

  async function deleteOrder(id: number) {
    setDeleting(true)
    const res = await fetch(`/api/expense-orders/${id}`, { method: 'DELETE' })
    setDeleting(false)
    if (res.ok) {
      setOrders(prev => prev.filter(o => o.id !== id))
      setConfirmDeleteId(null)
      setEditId(null)
    }
  }

  if (loading) return <div className="py-20 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className="p-2 space-y-2">
      <OrderForm form={form} setForm={setForm} itemNames={itemNames} vendorNames={vendorNames}
        listId="add-order" onSave={addOrder} saving={saving} saveLabel="+ Add to Expense Orders" />

      {orders.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-10">No expense orders yet — add anything the shop is thinking about buying.</p>
      ) : (
        <div className="space-y-1.5">
          {orders.map(o => (
            <div key={o.id} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
              {editId === o.id ? (
                <div className="p-2.5">
                  <OrderForm form={editForm} setForm={setEditForm} itemNames={itemNames} vendorNames={vendorNames}
                    listId={`edit-${o.id}`} onSave={saveEdit} onCancel={() => setEditId(null)} saving={editSaving} saveLabel="Save" />
                  <div className="mt-1.5 pt-1.5 border-t border-gray-100">
                    {confirmDeleteId === o.id ? (
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] text-gray-500">Delete this order?</span>
                        <button onClick={() => deleteOrder(o.id)} disabled={deleting}
                          className="text-[9px] font-bold text-white bg-red-600 rounded px-2 py-1 disabled:opacity-40">
                          {deleting ? 'Deleting…' : 'Yes, Delete'}
                        </button>
                        <button onClick={() => setConfirmDeleteId(null)}
                          className="text-[9px] font-semibold text-gray-600 bg-gray-100 rounded px-2 py-1">Cancel</button>
                      </div>
                    ) : (
                      <button onClick={() => setConfirmDeleteId(o.id)}
                        className="text-[9px] font-semibold text-red-600 bg-red-50 hover:bg-red-100 rounded px-2 py-1 transition">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="w-full">
                  {/* Notes rendered outside the button below -- a link
                      inside a <button> is invalid HTML and unreliable to
                      click (the button swallows the click first in some
                      browsers), so only the name/vendor/price row (no
                      links ever expected there) is the clickable-to-edit
                      surface. */}
                  <button onClick={() => openEdit(o)} className="w-full text-left px-2.5 pt-2 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] font-bold text-gray-900 truncate">{o.expense_name}</p>
                      {fmtPrice(o.price) != null && <p className="shrink-0 text-[11px] font-bold text-gray-700">₵{fmtPrice(o.price)}</p>}
                    </div>
                    <p className="text-[9px] text-gray-400">
                      {o.vendor_name ? o.vendor_name : 'No vendor decided'}
                      {o.entered_by ? ` · added by ${o.entered_by}` : ''}
                    </p>
                  </button>
                  {o.notes && (
                    <div onClick={() => openEdit(o)} className="px-2.5 pb-2 pt-1 cursor-pointer hover:bg-gray-50 transition">
                      <Linkify text={o.notes} as="p" className="text-[10px] text-gray-600 whitespace-pre-wrap line-clamp-2" />
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
