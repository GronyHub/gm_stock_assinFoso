'use client'
import { useState, useEffect } from 'react'
import { fmtDate } from '@/lib/fmtDate'

type Row = {
  entry_date: string
  cash_counted: number | null
  grony_personal_cash_in: number | null
  debtors_cash_in: number | null
  bills: number | null
  expenses: number | null
  grony_personal_expenses: number | null
  daily_net: number | null
  running_cash_at_bank: number | null
  cab_bank: number | null
  cab_momo: number | null
  cab_physical: number | null
  cab_total: number | null
  deficit: number | null
}

const TABS = ['List', 'CAB Weekly'] as const
type Tab = typeof TABS[number]

function Badge({ n }: { n: number }) {
  if (!n) return null
  return <span className="ml-1 bg-red-100 text-red-600 text-[10px] font-bold px-1.5 py-0.5 rounded-full">{n}</span>
}

const fmt = (n: any) => n == null ? '—' : `₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 2 })}`
const n = (v: any) => v == null ? '—' : Number(v).toLocaleString('en-GH', { minimumFractionDigits: 0 })
const nz = (v: any) => (v == null || Number(v) === 0) ? '' : n(v)

export default function CashAtBankClient({ rows }: { rows: Row[] }) {
  const [tab, setTab] = useState<Tab>('List')
  const [flags, setFlags] = useState<any | null>(null)
  const [flagsLoading, setFlagsLoading] = useState(false)

  useEffect(() => {
    if (tab === 'CAB Weekly' && !flags && !flagsLoading) {
      setFlagsLoading(true)
      fetch('/api/flags')
        .then(r => r.ok ? r.json() : Promise.reject(r.status))
        .then(d => { setFlags(d); setFlagsLoading(false) })
        .catch(() => { setFlags({ uncheckedCab: [] }); setFlagsLoading(false) })
    }
  }, [tab, flags, flagsLoading])

  return (
    <div className="py-4 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold">Cash at Bank</h1>
          <p className="text-sm text-gray-400 mt-0.5">Last 90 days · most recent first</p>
        </div>
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition
                ${tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
              {t}{t === 'CAB Weekly' && <Badge n={flags?.uncheckedCab.length ?? 0} />}
            </button>
          ))}
        </div>
      </div>

      {tab === 'List' && (
        <>
          {/* Mobile: card list */}
          <div className="md:hidden space-y-2">
            {rows.map((r: any) => {
              const hasConfirm = r.cab_total != null
              const net = Number(r.daily_net)
              return (
                <div key={r.entry_date}
                  className={`rounded-xl border p-3 space-y-2 ${hasConfirm ? 'bg-blue-50 border-blue-200' : 'bg-white border-gray-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">{fmtDate(String(r.entry_date).slice(0,10))}</span>
                    <span className="text-gray-900 font-bold text-base">{n(r.running_cash_at_bank)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Counted: <span className="text-gray-700 font-medium">{nz(r.cash_counted) || '—'}</span></span>
                    <span className={`font-medium ${net >= 0 ? 'text-green-600' : 'text-red-500'}`}>Net: {n(r.daily_net)}</span>
                  </div>
                  {hasConfirm && (
                    <div className="flex items-center justify-between text-sm pt-1.5 border-t border-blue-200">
                      <span className="text-blue-600 font-medium">Confirmed: {n(r.cab_total)}</span>
                      {r.deficit != null && (
                        <span className={`font-medium ${Number(r.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          Diff: {n(r.deficit)}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {/* Desktop: full table */}
          <div className="hidden md:block overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200 text-gray-500 text-xs uppercase">
                  <th className="px-3 py-3 text-left font-semibold">Date</th>
                  <th className="px-3 py-3 text-right font-semibold">Cash Counted</th>
                  <th className="px-3 py-3 text-right font-semibold">GP In</th>
                  <th className="px-3 py-3 text-right font-semibold">Debtors</th>
                  <th className="px-3 py-3 text-right font-semibold">Bills</th>
                  <th className="px-3 py-3 text-right font-semibold">Expenses</th>
                  <th className="px-3 py-3 text-right font-semibold">GP Out</th>
                  <th className="px-3 py-3 text-right font-semibold">Daily Net</th>
                  <th className="px-3 py-3 text-right font-semibold text-gray-700">Running Total</th>
                  <th className="px-3 py-3 text-right font-semibold text-blue-600">Confirmed</th>
                  <th className="px-3 py-3 text-right font-semibold text-red-500">Deficit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r: any) => {
                  const hasConfirm = r.cab_total != null
                  return (
                    <tr key={r.entry_date}
                      className={hasConfirm ? 'bg-blue-50' : 'hover:bg-gray-50'}>
                      <td className="px-3 py-2 text-gray-700 whitespace-nowrap">{fmtDate(String(r.entry_date).slice(0,10))}</td>
                      <td className="px-3 py-2 text-right text-gray-700">{nz(r.cash_counted) || '—'}</td>
                      <td className="px-3 py-2 text-right text-green-600">{nz(r.grony_personal_cash_in)}</td>
                      <td className="px-3 py-2 text-right text-green-600">{nz(r.debtors_cash_in)}</td>
                      <td className="px-3 py-2 text-right text-red-500">{nz(r.bills)}</td>
                      <td className="px-3 py-2 text-right text-red-500">{nz(r.expenses)}</td>
                      <td className="px-3 py-2 text-right text-orange-500">{nz(r.grony_personal_expenses)}</td>
                      <td className={`px-3 py-2 text-right font-medium ${Number(r.daily_net) >= 0 ? 'text-gray-800' : 'text-red-500'}`}>
                        {n(r.daily_net)}
                      </td>
                      <td className="px-3 py-2 text-right font-bold text-gray-900">{n(r.running_cash_at_bank)}</td>
                      <td className="px-3 py-2 text-right text-blue-600 font-medium">{hasConfirm ? n(r.cab_total) : ''}</td>
                      <td className={`px-3 py-2 text-right font-medium ${r.deficit != null && Number(r.deficit) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                        {r.deficit != null ? n(r.deficit) : ''}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {tab === 'CAB Weekly' && (
        <div>
          <p className="text-sm text-gray-400 mb-2">
            {flagsLoading || !flags ? 'Loading…' : `${flags.uncheckedCab.length} week${flags.uncheckedCab.length !== 1 ? 's' : ''} with no Cash at Bank confirmation`}
          </p>
          {flagsLoading || !flags ? null : flags.uncheckedCab.length === 0
            ? <p className="py-4 text-center text-gray-400 text-sm">All weeks have a cash-at-bank confirmation.</p>
            : <div className="bg-white border border-gray-200 rounded-lg overflow-hidden divide-y divide-gray-100">
                {flags.uncheckedCab.map((r: any) => (
                  <div key={r.week_start} className="flex items-center justify-between px-3 py-2 gap-2">
                    <div className="min-w-0 flex-1">
                      <span className="text-sm font-semibold text-gray-900">{fmtDate(r.week_start)} – {fmtDate(r.week_end)}</span>
                    </div>
                    <button onClick={() => setTab('List')}
                      className="shrink-0 text-xs font-semibold px-2 py-1 rounded bg-blue-50 text-blue-600 hover:bg-blue-100 transition">
                      View List →
                    </button>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  )
}
