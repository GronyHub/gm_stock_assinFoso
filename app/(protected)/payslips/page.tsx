'use client'
import { useState, useEffect } from 'react'

type Payslip = {
  id: number
  staff_name: string
  pay_month: string
  payment_period: string | null
  hours_worked: string | null
  pay_for_hours: string | null
  overtime_hours: string | null
  pay_for_overtime: string | null
  longevity_days: string | null
  pay_for_longevity: string | null
  duty_allowance: string | null
  data_allowance: string | null
  ssnit: string | null
  total_salary: string | null
}

function fmt(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : `₵${n.toFixed(2)}`
}

function num(v: string | null) {
  if (!v) return '—'
  const n = parseFloat(v)
  return isNaN(n) ? '—' : n.toLocaleString('en-GH', { maximumFractionDigits: 2 })
}

function monthLabel(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-GH', { month: 'long', year: 'numeric' })
}

const STAFF_COLORS: Record<string, string> = {
  Joe: 'bg-blue-100 text-blue-700',
  Bino: 'bg-purple-100 text-purple-700',
  James: 'bg-green-100 text-green-700',
  Rawlings: 'bg-orange-100 text-orange-700',
}

export default function PayslipsPage() {
  const [payslips, setPayslips] = useState<Payslip[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Payslip | null>(null)
  const [staffFilter, setStaffFilter] = useState<string>('All')

  useEffect(() => {
    fetch('/api/payslips').then(r => r.json()).then(d => {
      setPayslips(d); setLoading(false)
    })
  }, [])

  const staffNames = ['All', ...Array.from(new Set(payslips.map(p => p.staff_name))).sort()]
  const filtered = staffFilter === 'All' ? payslips : payslips.filter(p => p.staff_name === staffFilter)

  if (loading) return <div className="py-20 text-center text-gray-400">Loading…</div>

  return (
    <div className="py-4 space-y-4">
      <div>
        <h1 className="text-xl font-bold">Payslips</h1>
        <p className="text-sm text-gray-400 mt-0.5">{filtered.length} payslip{filtered.length !== 1 ? 's' : ''}</p>
      </div>

      {/* Staff filter — only shown if multiple staff visible */}
      {staffNames.length > 2 && (
        <div className="flex gap-1.5 overflow-x-auto pb-1">
          {staffNames.map(s => (
            <button key={s} onClick={() => setStaffFilter(s)}
              className={`shrink-0 px-3 py-1.5 rounded-lg text-sm font-medium transition
                ${staffFilter === s ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s}
            </button>
          ))}
        </div>
      )}

      {/* Selected detail panel */}
      {selected && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[selected.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>
                  {selected.staff_name}
                </span>
                <span className="text-base font-bold text-gray-900">{monthLabel(selected.pay_month)}</span>
              </div>
              {selected.payment_period && (
                <p className="text-xs text-gray-400 mt-1">{selected.payment_period}</p>
              )}
            </div>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-600 text-lg font-bold">×</button>
          </div>

          <div className="border-t border-gray-100 pt-3 space-y-2">
            <Row label="Hours worked" value={num(selected.hours_worked)} />
            <Row label="Pay for hours" value={fmt(selected.pay_for_hours)} highlight />
            <Row label="Overtime hours" value={num(selected.overtime_hours)} />
            <Row label="Pay for overtime" value={fmt(selected.pay_for_overtime)} highlight />
            <Row label="Longevity days" value={num(selected.longevity_days)} />
            <Row label="Pay for longevity" value={fmt(selected.pay_for_longevity)} highlight />
            <Row label="Duty allowance" value={fmt(selected.duty_allowance)} highlight />
            <Row label="Data allowance" value={fmt(selected.data_allowance)} highlight />
            {selected.ssnit && <Row label="SSNIT" value={fmt(selected.ssnit)} />}
          </div>

          <div className="border-t border-gray-200 pt-3 flex justify-between items-center">
            <span className="text-sm font-bold text-gray-700">Total Salary</span>
            <span className="text-xl font-bold text-green-700">{fmt(selected.total_salary)}</span>
          </div>
        </div>
      )}

      {/* Payslip list */}
      <div className="space-y-2">
        {filtered.length === 0 && (
          <p className="py-10 text-center text-gray-400 text-sm">No payslips found.</p>
        )}
        {filtered.map(p => (
          <button key={p.id} onClick={() => setSelected(p === selected ? null : p)}
            className={`w-full text-left rounded-xl border p-3 transition
              ${selected?.id === p.id ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white hover:border-gray-300'}`}>
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span className={`shrink-0 text-xs font-semibold px-2.5 py-0.5 rounded-full ${STAFF_COLORS[p.staff_name] ?? 'bg-gray-100 text-gray-600'}`}>
                  {p.staff_name}
                </span>
                <span className="text-sm font-medium text-gray-800 truncate">{monthLabel(p.pay_month)}</span>
              </div>
              <span className="shrink-0 text-sm font-bold text-gray-900">{fmt(p.total_salary)}</span>
            </div>
            {p.payment_period && (
              <p className="text-xs text-gray-400 mt-1 ml-0.5">{p.payment_period}</p>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-semibold ${highlight ? 'text-gray-900' : 'text-gray-600'}`}>{value}</span>
    </div>
  )
}
