'use client'
import { useState } from 'react'

export type ClosingAnswers = {
  no_tshirt_staff: string[]
  advert_played: boolean
  property_issue: boolean
  speaker_brought_in: boolean
  new_customer: boolean
  new_customer_details: string | null
  unfortunate_event: boolean
  unfortunate_event_details: string | null
}

function YesNo({ value, onChange }: { value: boolean | null; onChange: (v: boolean) => void }) {
  return (
    <div className="flex gap-2">
      <button type="button" onClick={() => onChange(true)}
        className={`flex-1 text-sm font-semibold rounded-lg py-2 border transition
          ${value === true ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        Yes
      </button>
      <button type="button" onClick={() => onChange(false)}
        className={`flex-1 text-sm font-semibold rounded-lg py-2 border transition
          ${value === false ? 'bg-red-500 border-red-500 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
        No
      </button>
    </div>
  )
}

const qCls = 'text-sm font-semibold text-gray-800'
const textareaCls = 'w-full bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-2 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-blue-400'

// End-of-day questionnaire the Closer (last staff member to clock out) must
// answer before their clock-out is accepted.
export default function CloserQuestionnaire({ presentStaff, saving, onSubmit, onCancel }: {
  presentStaff: string[]
  saving: boolean
  onSubmit: (answers: ClosingAnswers) => void
  onCancel: () => void
}) {
  const [noTshirt, setNoTshirt] = useState<string[]>([])
  const [advert, setAdvert] = useState<boolean | null>(null)
  const [property, setProperty] = useState<boolean | null>(null)
  const [speaker, setSpeaker] = useState<boolean | null>(null)
  const [newCustomer, setNewCustomer] = useState<boolean | null>(null)
  const [newCustomerDetails, setNewCustomerDetails] = useState('')
  const [unfortunate, setUnfortunate] = useState<boolean | null>(null)
  const [unfortunateDetails, setUnfortunateDetails] = useState('')
  const [error, setError] = useState<string | null>(null)

  function toggleStaff(name: string) {
    setNoTshirt(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name])
  }

  function submit() {
    setError(null)
    if (advert === null || property === null || speaker === null || newCustomer === null || unfortunate === null) {
      setError('Please answer every question (Yes or No).')
      return
    }
    if (newCustomer && !newCustomerDetails.trim()) {
      setError('Please describe the experience with the new customer.')
      return
    }
    if (unfortunate && !unfortunateDetails.trim()) {
      setError('Please describe the unfortunate event.')
      return
    }
    onSubmit({
      no_tshirt_staff: noTshirt,
      advert_played: advert,
      property_issue: property,
      speaker_brought_in: speaker,
      new_customer: newCustomer,
      new_customer_details: newCustomer ? newCustomerDetails.trim() : null,
      unfortunate_event: unfortunate,
      unfortunate_event_details: unfortunate ? unfortunateDetails.trim() : null,
    })
  }

  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[92dvh] overflow-y-auto p-4 space-y-4">
        <div>
          <p className="font-bold text-gray-900 text-base">🌙 You are the Closer for today</p>
          <p className="text-xs text-gray-500 mt-0.5">
            You&apos;re the last one clocking out. Please answer these closing questions before your Time Out is recorded.
          </p>
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>1. Select the staff who didn&apos;t wear the company T-shirt today</p>
          <p className="text-[11px] text-gray-400">Leave everyone unticked if all staff wore it.</p>
          <div className="space-y-1">
            {presentStaff.map(name => (
              <label key={name} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 cursor-pointer">
                <input type="checkbox" checked={noTshirt.includes(name)} onChange={() => toggleStaff(name)}
                  className="w-4 h-4 accent-red-500" />
                <span className="text-sm capitalize text-gray-800">{name}</span>
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>2. Was the roadside advert played today?</p>
          <YesNo value={advert} onChange={setAdvert} />
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>3. Any spoilt property or lost property for today?</p>
          <YesNo value={property} onChange={setProperty} />
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>4. Have you brought in the Speaker and wires into the shop?</p>
          <YesNo value={speaker} onChange={setSpeaker} />
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>5. Any new customer of interest?</p>
          <YesNo value={newCustomer} onChange={setNewCustomer} />
          {newCustomer && (
            <textarea value={newCustomerDetails} onChange={e => setNewCustomerDetails(e.target.value)}
              rows={3} placeholder="Write about the experience with the new customer…" className={textareaCls} />
          )}
        </div>

        <div className="space-y-1.5">
          <p className={qCls}>6. Any unfortunate event for today?</p>
          <YesNo value={unfortunate} onChange={setUnfortunate} />
          {unfortunate && (
            <textarea value={unfortunateDetails} onChange={e => setUnfortunateDetails(e.target.value)}
              rows={3} placeholder="Write about what happened…" className={textareaCls} />
          )}
        </div>

        {error && <p className="text-xs text-red-600 bg-red-50 rounded-lg px-2.5 py-1.5">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button onClick={submit} disabled={saving}
            className="flex-1 bg-orange-500 hover:bg-orange-400 disabled:opacity-40 text-white text-sm font-semibold rounded-xl py-2.5 transition">
            {saving ? 'Saving…' : 'Submit & Clock Out'}
          </button>
          <button onClick={onCancel} disabled={saving}
            className="px-4 py-2.5 bg-gray-100 text-gray-600 text-sm font-semibold rounded-xl">
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
