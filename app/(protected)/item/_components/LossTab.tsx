import { useState, useEffect, useMemo } from 'react'
import { ItemsAnalyticsSection } from './ItemsAnalyticsSection'

const PAPER_SELL_PRICE = 20
const PACK_LOSS_VALUATION = 'chain' // 'chain' or 'naive'

type SortCol = 'item_name' | 'lgAmt' | 'cnt' | 'wic' | 'gmc' | 'bl' | 'lossCount' | 'gainCount'
type Sort = { col: SortCol; dir: 'asc' | 'desc' }

export type AliasRecord = { id: number; name: string }
export type MatchRecord = { id: number; name: string }

export type SummaryRow = {
  item_id: number
  item_name: string
  cf_group: string | null
  product_type: string | null
  soh: string | null
  sp: string | null
  cp: string | null
  units_per_pack: string | null
  converts_to_item_id: number | null
  count_interval: string | null
  lgQty: number
  lgAmt: number
  lossCount: number
  gainAmt: number
  gainCount: number
  cnt: number
  wic: number
  gmc: number
  bl: number
  cnv: number
}

type CandidateItem = { item_id: number; item_name: string; product_type?: string }

type DayRow = {
  item_id: number
  date: string
  qty_counted: string | null
  wic_qty: string | null
  gmc_qty: string | null
  bills_qty: string | null
  converted_in_qty: string | null
  counted_by?: string | null
  counted_at?: string | null
  sell_price?: string | null
  aliases?: string | null
}

const numVal = (v: string | null | undefined) => v ? parseFloat(v) : 0
const fmtQ = (v: number) => v.toFixed(2)
const fmtQs = (v: string | null) => fmtQ(numVal(v))
const fmtN = (v: number) => v.toFixed(2)
const fmtAmt = (v: number) => v.toFixed(2)
const fmtCcy = (v: string | null) => (v ? `₵${numVal(v).toFixed(2)}` : '—')
const fmtDate = (date: string) => {
  if (!date) return '—'
  const d = new Date(date + 'T00:00:00Z')
  const month = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  const year = String(d.getUTCFullYear()).slice(2)
  return `${day} ${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getUTCMonth()]} '${year}`
}

const shortSourceName = (name: string) => name.replace(/^Service - /, 'Svc: ').slice(0, 10)

type DayRowComputed = DayRow & {
  loss: number | null
  expected_soh: number | null
  available: number
  wic_breakdown?: { name: string; qty: number; amount: number }[]
  count_history?: string
}

function computeRows(rows: DayRow[]) {
  let prev: number | null = null
  return rows.map(row => {
    const counted = row.qty_counted !== null ? parseFloat(row.qty_counted) : null
    const bills = numVal(row.bills_qty), w = numVal(row.wic_qty), g = numVal(row.gmc_qty), c = numVal(row.converted_in_qty)
    if (prev === null) {
      if (counted !== null) prev = counted
    } else {
      const expected: number = prev + bills + c - w - g
      if (counted !== null) {
        prev = counted
        return {
          ...row,
          available: expected,
          loss: expected - counted,
          expected_soh: counted,
        }
      } else {
        prev = expected
        return {
          ...row,
          available: expected,
          loss: null,
          expected_soh: expected,
        }
      }
    }
    return {
      ...row,
      available: counted ?? 0,
      loss: null,
      expected_soh: counted,
    }
  })
}

type PackChainRow = {
  date: string
  packCnt: number | null
  packCntBy: string | null
  packCntAt: string | null
  packCntHistory?: string
  packBl: number
  packGmc: number
  packWic: number
  packExp: number
  packLoss: number | null
  packAliases: string | null
  singlesConvIn: number
  singlesBreakdown: { name: string; qty: number; amount: number }[]
  singlesCnt: number | null
  singlesCntBy: string | null
  singlesCntAt: string | null
  singlesCntHistory?: string
  singlesUsed: number
  singlesExp: number
  singlesLoss: number | null
  singlesAliases: string | null
}

function buildPackChainRows(packRows: DayRowComputed[], singlesRows: DayRowComputed[]): PackChainRow[] {
  const packByDate = new Map(packRows.map(r => [r.date, r]))
  const singlesMap = new Map(singlesRows.map(r => [r.date, r]))
  const allDates = Array.from(new Set([...packRows.map(r => r.date), ...singlesRows.map(r => r.date)])).sort()
  return allDates.map(date => ({
    date,
    packCnt: packByDate.get(date)?.qty_counted ? parseFloat(packByDate.get(date)?.qty_counted || '0') : null,
    packCntBy: packByDate.get(date)?.counted_by || null,
    packCntAt: packByDate.get(date)?.counted_at || null,
    packCntHistory: packByDate.get(date)?.count_history,
    packBl: numVal(packByDate.get(date)?.bills_qty),
    packGmc: numVal(packByDate.get(date)?.gmc_qty),
    packWic: numVal(packByDate.get(date)?.wic_qty),
    packExp: packByDate.get(date)?.expected_soh ?? 0,
    packLoss: packByDate.get(date)?.loss ?? null,
    packAliases: packByDate.get(date)?.aliases || null,
    singlesConvIn: numVal(singlesMap.get(date)?.converted_in_qty),
    singlesBreakdown: singlesMap.get(date)?.wic_breakdown ?? [],
    singlesCnt: singlesMap.get(date)?.qty_counted ? parseFloat(singlesMap.get(date)?.qty_counted || '0') : null,
    singlesCntBy: singlesMap.get(date)?.counted_by || null,
    singlesCntAt: singlesMap.get(date)?.counted_at || null,
    singlesCntHistory: singlesMap.get(date)?.count_history,
    singlesUsed: numVal(singlesMap.get(date)?.wic_qty) + numVal(singlesMap.get(date)?.gmc_qty),
    singlesExp: singlesMap.get(date)?.expected_soh ?? 0,
    singlesLoss: singlesMap.get(date)?.loss ?? null,
    singlesAliases: singlesMap.get(date)?.aliases || null,
  }))
}

type Omission = { date: string; description: string }
type PackCycle = { start: string; end: string | null; sheetsGiven: number; used: number }
function buildPackCycles(singlesRows: DayRowComputed[]): PackCycle[] {
  const cycles: PackCycle[] = []
  let cycle: PackCycle | null = null
  for (const row of singlesRows) {
    if (row.converted_in_qty && numVal(row.converted_in_qty) > 0) {
      if (cycle) { cycle.end = row.date }
      cycle = { start: row.date, end: null, sheetsGiven: numVal(row.converted_in_qty), used: 0 }
      cycles.push(cycle)
    } else if (cycle) {
      cycle.used += numVal(row.wic_qty) + numVal(row.gmc_qty)
    }
  }
  return cycles
}

function computePackChainOmissions(rows: PackChainRow[], unitsPerPack: number, itemName: string): Map<string, Omission[]> {
  const omissions = new Map<string, Omission[]>()
  for (const row of rows) {
    const o: Omission[] = []
    if (row.packExp > 0 && row.singlesCnt !== null) {
      if (row.singlesConvIn === 0 && row.singlesWic === 0) {
        o.push({ date: row.date, description: `${itemName} has stock (${row.packExp} packs) but sheets not used or converted that day` })
      }
    }
    if (o.length > 0) omissions.set(row.date, o)
  }
  return omissions
}

function rowLossCedis(row: PackChainRow, unitsPerPack: number, sheetPrice: number): number | null {
  if (row.packLoss === null) return null
  const packLossCedis = row.packLoss * unitsPerPack * sheetPrice
  const singlesLossCedis = (row.singlesLoss ?? 0) * sheetPrice
  return packLossCedis + singlesLossCedis
}

function SingleServicePackChainTable({ item, targetName, packChainRows, packCyclesByStart, closedCycles, packLossTotal, packGainTotal, cycleLossTotal, cycleGainTotal, unitsPerPack, sheetPrice, sheetCP, sp, onDateClick, showPrices, lossOnly, gainOnly }: {
  item: SummaryRow; targetName: string; packChainRows: PackChainRow[]; packCyclesByStart: Map<string, PackCycle>; closedCycles: PackCycle[]
  packLossTotal: number; packGainTotal: number; cycleLossTotal: number; cycleGainTotal: number; unitsPerPack: number; sheetPrice: number; sheetCP: number; sp: number
  onDateClick?: (date: string, itemName: string) => void; packChainBreakdownNames: string[]; showPrices?: boolean; lossOnly?: boolean; gainOnly?: boolean
}) {
  const colgroup = (
    <colgroup>
      <col style={{ width: '48px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '36px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '40px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '36px' }} />
      <col style={{ width: '48px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '28px' }} />
      <col style={{ width: '40px' }} />
    </colgroup>
  )
  const filtered = packChainRows.filter(r =>
    (!lossOnly || (r.packLoss ?? 0) > 0.001 || (r.singlesLoss ?? 0) > 0.001)
    && (!gainOnly || (r.packLoss ?? 0) < -0.001 || (r.singlesLoss ?? 0) < -0.001)
  )
  return (
    <table className="w-full border-collapse text-[7px]" style={{ minWidth: `${48 + 7 * 28 + 2 * 36 + 40 + 48}px` }}>
      {colgroup}
      <thead className="sticky top-0 z-10">
        <tr className="bg-amber-500 text-gray-800 font-bold">
          <th rowSpan={2} className="py-0 border-b border-gray-400 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-amber-500">DATE</th>
          <th colSpan={7} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600">{item.item_name}</th>
          <th colSpan={7} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600">{targetName}</th>
          <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-l-gray-600" title="Loss cedis">LOSS ₵</th>
        </tr>
        <tr className="bg-amber-400 text-gray-800 font-bold">
          <th className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600">CNT</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">BL</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">GMC</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">WIC</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">EXP</th>
          {showPrices && <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">SP</th>}
          {showPrices && <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">L/G</th>}
          <th className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600">CNV</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">USED</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">EXP</th>
          <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">L/G</th>
          {showPrices && <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">SP</th>}
          {showPrices && <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">CP</th>}
        </tr>
      </thead>
      <tbody>
        {filtered.map(row => {
          const cycle = packCyclesByStart.get(row.date)
          return (
            <tr key={row.date} className={`border-b border-gray-200 ${
              (row.packLoss ?? 0) > 0.001 || (row.singlesLoss ?? 0) > 0.001 ? 'bg-red-50'
              : cycle ? 'bg-blue-50'
              : 'bg-white'
            }`}>
              <td className="pl-0.5 py-0 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                {onDateClick ? (
                  <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">{fmtDate(row.date)}</button>
                ) : fmtDate(row.date)}
              </td>
              <td className="text-center py-0 leading-none font-bold border-l-2 border-l-gray-600 text-gray-900">
                <CntValue qty={row.packCnt} countedBy={row.packCntBy} countedAt={row.packCntAt} history={row.packCntHistory} />
              </td>
              <td className="text-center py-0 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.packBl.toString())}</td>
              <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtN(row.packGmc)}</td>
              <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtN(row.packWic)}</td>
              <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.packExp)}</td>
              {showPrices && <td className="text-center py-0 font-bold border-l border-gray-300 text-blue-600">{fmtCcy(sp.toString())}</td>}
              {showPrices && <td className="text-center py-0 font-bold border-l border-gray-300">{row.packLoss === null ? '—' : row.packLoss > 0.001 ? `-${fmtN(row.packLoss)}` : '0'}</td>}
              <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 text-teal-600">{fmtN(row.singlesConvIn)}</td>
              <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-600">{fmtN(row.singlesUsed)}</td>
              <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.singlesExp)}</td>
              <td className="text-center py-0 font-bold border-l border-gray-300">{row.singlesLoss === null ? '—' : row.singlesLoss > 0.001 ? `-${fmtN(row.singlesLoss)}` : row.singlesLoss < -0.001 ? `+${fmtN(Math.abs(row.singlesLoss))}` : '0'}</td>
              {showPrices && <td className="text-center py-0 font-bold border-l border-gray-300 text-blue-600">{fmtCcy(sheetPrice.toString())}</td>}
              {showPrices && <td className="text-center py-0 font-bold border-l border-gray-300 text-green-600">{fmtCcy(sheetCP.toString())}</td>}
              <td className="text-center py-0 font-bold border-l-2 border-l-gray-600">
                {(() => {
                  const cedis = rowLossCedis(row, unitsPerPack, sheetPrice)
                  return cedis === null ? '—' : cedis > 0.001 ? `-₵${fmtN(cedis)}` : cedis < -0.001 ? `+₵${fmtN(Math.abs(cedis))}` : '0'
                })()}
              </td>
            </tr>
          )
        })}
        <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
          <td colSpan={2} className="text-left pl-0.5 py-0 text-gray-600">Total</td>
          <td className="text-center py-0 border-l border-gray-300" />
          <td className="text-center py-0 border-l border-gray-300" />
          <td className="text-center py-0 border-l border-gray-300" />
          <td className="text-center py-0 border-l border-gray-300" />
          {showPrices && <td className="text-center py-0 border-l border-gray-300" />}
          {showPrices && <td className="text-center py-0 border-l border-gray-300 text-red-600">-{fmtN(packLossTotal)}</td>}
          <td className="text-center py-0 border-l-2 border-l-gray-600" />
          <td className="text-center py-0 border-l border-gray-300" />
          <td className="text-center py-0 border-l border-gray-300" />
          <td className="text-center py-0 border-l border-gray-300" />
          {showPrices && <td className="text-center py-0 border-l border-gray-300" />}
          {showPrices && <td className="text-center py-0 border-l border-gray-300" />}
          <td className="text-center py-0 border-l-2 border-l-gray-600 text-red-600">-₵{fmtN(cycleLossTotal * sheetPrice)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function CntValue({ qty, countedBy, countedAt, history }: { qty: number | null; countedBy?: string | null; countedAt?: string | null; history?: string }) {
  if (qty === null) return <span className="text-gray-300">—</span>
  const title = [countedBy, countedAt].filter(Boolean).join(' at ') + (history ? ` · history: ${history}` : '')
  return <span title={title}>{fmtQ(qty)}</span>
}

export function ItemDetail({ item, groups, allItems, currentAliases, currentMatches, candidatePool, mergePool, isOwnerLevelUser, onSaved, onRelationsSaved, onMerged, onDateClick, showPrices, lossOnly, gainOnly, maxRows }: {
  item: SummaryRow; groups: string[]; allItems: { item_id: number; item_name: string }[]
  currentAliases: AliasRecord[]; currentMatches: MatchRecord[]
  candidatePool: CandidateItem[]
  mergePool: CandidateItem[]
  isOwnerLevelUser: boolean
  onSaved: (u: Partial<SummaryRow>) => void
  onRelationsSaved: (aliases: AliasRecord[], matches: MatchRecord[]) => void
  onMerged: () => void
  onDateClick?: (date: string, itemName: string) => void
  showPrices?: boolean
  gainOnly?: boolean
  lossOnly?: boolean
  maxRows?: number
}) {
  const [dayRows, setDayRows] = useState<DayRow[] | null>(null)
  const [editing, setEditing] = useState(false)
  const [form, setForm] = useState({ item_name: '', cf_group: '', selling_rate: '', purchase_rate: '', units_per_pack: '', unit_name: '', converts_to_item_id: '', count_excluded: false, count_cadence_days: '', count_excluded_reason: '', gmc_type: '' })
  const [currentCountInterval, setCurrentCountInterval] = useState<string | null>(null)
  const [currentSoh, setCurrentSoh] = useState<number | null>(null)
  const [editError, setEditError] = useState('')
  const [aliases, setAliases] = useState<AliasRecord[]>(currentAliases)
  const [matches, setMatches] = useState<MatchRecord[]>(currentMatches)
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  async function deleteItem() {
    setDeleting(true); setDeleteError('')
    const res = await fetch(`/api/items/${item.item_id}`, { method: 'DELETE' })
    const d = await res.json().catch(() => ({}))
    setDeleting(false)
    if (res.ok) { setEditing(false); onMerged() }
    else setDeleteError(d.error || 'Could not delete item.')
  }

  useEffect(() => {
    fetch(`/api/losses/${item.item_id}`).then(r => r.json())
      .then(d => setDayRows(Array.isArray(d) ? d : []))
      .catch(() => setDayRows([]))
  }, [item.item_id])

  const isPackChain = item.product_type !== 'service' && item.converts_to_item_id != null
  const [targetDayRows, setTargetDayRows] = useState<DayRow[] | null>(null)

  const [sheetPrice, setSheetPrice] = useState<number>(PAPER_SELL_PRICE)
  const [sheetCP, setSheetCP] = useState<number>(0)

  useEffect(() => {
    if (!isPackChain || item.converts_to_item_id == null) return
    fetch(`/api/items/${item.converts_to_item_id}`).then(r => r.json())
      .then(d => {
        const sp = parseFloat(d?.selling_price ?? '0') || 0
        setSheetPrice(sp > 0 ? sp : PAPER_SELL_PRICE)
        setSheetCP(parseFloat(d?.purchase_rate ?? '0') || 0)
      })
      .catch(() => {})
  }, [isPackChain, item.converts_to_item_id])

  useEffect(() => {
    if (!isPackChain || item.converts_to_item_id == null) { setTargetDayRows(null); return }
    fetch(`/api/losses/${item.converts_to_item_id}`).then(r => r.json())
      .then(d => setTargetDayRows(Array.isArray(d) ? d : []))
      .catch(() => setTargetDayRows([]))
  }, [isPackChain, item.converts_to_item_id])

  function startEdit() {
    setForm({
      item_name: item.item_name, cf_group: item.cf_group || '',
      selling_rate: item.sp || '', purchase_rate: item.cp || '',
      units_per_pack: item.units_per_pack || '', unit_name: '',
      converts_to_item_id: item.converts_to_item_id ? String(item.converts_to_item_id) : '',
      count_excluded: false, count_cadence_days: '', count_excluded_reason: '', gmc_type: item.gmc_type || ''
    })
    setEditError('')
    fetch(`/api/items/${item.item_id}`).then(r => r.json())
      .then(d => {
        setForm(f => ({
          ...f,
          count_excluded: !!d?.count_excluded,
          count_cadence_days: d?.count_cadence_days != null ? String(d.count_cadence_days) : '',
          count_excluded_reason: d?.count_excluded_reason ?? '',
        }))
        setCurrentCountInterval(d?.count_interval ?? null)
        setCurrentSoh(d?.calculated_soh != null ? parseFloat(d.calculated_soh) : null)
      })
      .catch(() => {})
  }

  async function saveEdit() {
    setSaving(true)
    setEditError('')
    const res = await fetch(`/api/items/${item.item_id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        item_name: form.item_name || undefined,
        cf_group: form.cf_group || null,
        selling_rate: form.selling_rate ? parseFloat(form.selling_rate) : null,
        purchase_rate: form.purchase_rate ? parseFloat(form.purchase_rate) : null,
        units_per_pack: form.units_per_pack ? parseFloat(form.units_per_pack) : null,
        unit_name: form.unit_name || null,
        converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
        count_excluded: form.count_excluded,
        count_cadence_days: form.count_cadence_days ? parseInt(form.count_cadence_days, 10) : null,
        count_excluded_reason: form.count_excluded_reason || null,
        gmc_type: form.gmc_type || null,
      }),
    })
    setSaving(false)
    const d = await res.json().catch(() => null)
    if (!res.ok) {
      setEditError(d?.error ?? 'Could not save changes.')
      return
    }
    setEditing(false)
    setCurrentCountInterval(d?.count_interval ?? null)
    onSaved({
      item_name: form.item_name || item.item_name, cf_group: form.cf_group || null, sp: form.selling_rate || item.sp, cp: form.purchase_rate || item.cp,
      units_per_pack: form.units_per_pack || null,
      converts_to_item_id: form.converts_to_item_id ? Number(form.converts_to_item_id) : null,
      count_interval: d?.count_interval ?? null,
      gmc_type: form.gmc_type || null,
    })
    onRelationsSaved(aliases, matches)
  }

  const computed = dayRows ? computeRows(dayRows) : null
  const sp = parseFloat(item.sp ?? '0') || 0
  const totalLoss = computed ? parseFloat(computed.reduce((s, r) => s + (r.loss ?? 0), 0).toFixed(4)) : 0
  const totalCost = parseFloat((totalLoss * sp).toFixed(2))
  const displayedRows = maxRows && computed ? computed.slice(0, maxRows) : computed
  const hasMoreRows = maxRows && computed ? computed.length > maxRows : false
  const lgCls = `px-4 py-2.5 text-right ${totalLoss > 0 ? 'text-red-500' : totalLoss < 0 ? 'text-green-600' : 'text-gray-400'}`

  const breakdownNames = computed
    ? Array.from(new Set(computed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const showBreakdown = breakdownNames.length >= 2

  const targetComputed = targetDayRows ? computeRows(targetDayRows) : null
  const targetName = allItems.find(a => a.item_id === item.converts_to_item_id)?.item_name ?? 'target item'
  const packChainRows = isPackChain && computed && targetComputed ? buildPackChainRows(computed, targetComputed) : []
  const packChainOmissionsByDate = packChainRows.length > 0
    ? computePackChainOmissions(packChainRows, numVal(item.units_per_pack), item.item_name)
    : new Map<string, Omission[]>()
  const packCycles = isPackChain && targetComputed ? buildPackCycles(targetComputed) : []
  const packCyclesByStart = new Map(packCycles.map(c => [c.start, c]))
  const packLossTotal = parseFloat(packChainRows.reduce((s, r) => s + ((r.packLoss ?? 0) > 0.001 ? (r.packLoss as number) : 0), 0).toFixed(2))
  const packGainTotal = parseFloat(packChainRows.reduce((s, r) => s + ((r.packLoss ?? 0) < -0.001 ? -(r.packLoss as number) : 0), 0).toFixed(2))
  const closedCycles = packCycles.filter(c => c.end !== null)
  const cycleLossTotal = parseFloat(closedCycles.reduce((s, c) => s + Math.max(0, c.sheetsGiven - c.used), 0).toFixed(2))
  const cycleGainTotal = parseFloat(packCycles.reduce((s, c) => s + Math.max(0, c.used - c.sheetsGiven), 0).toFixed(2))
  const packChainBreakdownNames: string[] = targetComputed
    ? Array.from(new Set(targetComputed.flatMap(r => (r.wic_breakdown ?? []).map(b => b.name)))).sort()
    : []
  const packChainColW = Math.max(4, Math.min(6, Math.floor(12 / Math.max(1, packChainBreakdownNames.length))))
  const unitsPerPack = numVal(item.units_per_pack)
  const singleServiceChain = packChainBreakdownNames.length <= 1

  return (
    <div className={`bg-white border border-gray-200 rounded-lg mt-0 ${isPackChain ? 'w-max min-w-full' : 'overflow-hidden'}`}>
      {!dayRows || (isPackChain && !targetDayRows) ? (
        <p className="text-sm text-gray-400 text-center py-6">Loading…</p>
      ) : isPackChain ? (
        packChainRows.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">No activity.</p>
        ) : singleServiceChain ? (
          <SingleServicePackChainTable
            item={item} targetName={targetName} packChainRows={packChainRows}
            packCyclesByStart={packCyclesByStart} closedCycles={closedCycles}
            packLossTotal={packLossTotal} packGainTotal={packGainTotal}
            cycleLossTotal={cycleLossTotal} cycleGainTotal={cycleGainTotal}
            unitsPerPack={unitsPerPack} sheetPrice={sheetPrice} sheetCP={sheetCP} sp={sp}
            onDateClick={onDateClick}
            packChainBreakdownNames={packChainBreakdownNames}
            showPrices={showPrices ?? false}
            lossOnly={lossOnly ?? false}
            gainOnly={gainOnly ?? false}
          />
        ) : (
          <>
            <p className="text-[7px] font-bold text-gray-500 px-1 py-0.5 bg-gray-50 border-b border-gray-200">
              Combined view: {item.item_name} <span className="text-gray-400">(ID: {item.item_id})</span> → {targetName} → services
            </p>
            <table className="table-fixed border-collapse text-[7px]"
              style={{ width: `${48 + 2 * 40 + 10 * 28 + packChainBreakdownNames.length * 48 + 44 + 48 + 56 + 48 + 2 * 56}px` }}>
              <colgroup>
                <col style={{width:'48px'}} />
                <col style={{width:'40px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'48px'}} />
                <col style={{width:'56px'}} />
                <col style={{width:'48px'}} />
                {packChainBreakdownNames.map(n => <col key={n} style={{width:'48px'}} />)}
                <col style={{width:'40px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'28px'}} />
                <col style={{width:'44px'}} />
                <col style={{width:'56px'}} /><col style={{width:'56px'}} />
              </colgroup>
              <thead className="sticky top-0 z-10">
                <tr className="bg-amber-500 text-gray-800 font-bold">
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-left pl-0.5 align-bottom sticky left-0 z-20 bg-amber-500 text-[6px]">DATE</th>
                  <th colSpan={7} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[6px]">
                    {item.item_name} <span className="text-gray-400">(ID: {item.item_id})</span>
                  </th>
                  <th colSpan={8 + packChainBreakdownNames.length} className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[6px]">
                    {targetName}
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-l-gray-600 text-[6px]"
                    title={`Losses valued in cedis at ₵${sheetPrice} per single. Pack losses count as packs × singles-per-pack × ₵${sheetPrice} — treated as singles that were used but never recorded, NOT at the pack's own selling price.`}>
                    LOSS ₵
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-l-gray-600 text-[6px]"
                    title="Raw item name as recorded on the pack's own transaction that day, before canonicalization.">
                    PACK ALIAS
                  </th>
                  <th rowSpan={2} className="py-0 border-b border-gray-400 text-center align-bottom border-l border-gray-400 text-[6px]"
                    title="Raw item name as recorded on the singles/service transaction that day, before canonicalization.">
                    SINGLES ALIAS
                  </th>
                </tr>
                <tr className="bg-amber-400 text-gray-800 font-bold">
                  <th className="py-0 border-b border-gray-400 text-center border-l border-l-gray-600 text-[6px]" title="Physical count">CNT</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[6px]" title="Bought/received">BL</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[6px]" title="Taken for internal use (credits singles below)">GMC</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400 text-[6px]" title="Sold as whole packs to a real customer">WIC</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="Packs missing at count. Column total shown below the label.">PACK LOSS</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400"
                    title="Sheets from packs that went into singles but were never accounted for. (Column total ↓)">PACK GAIN</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Converted from this item's GMC takes (credits to other items tracked below)">CONV IN</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">USED</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">EXP</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400">L/G</th>
                  {packChainBreakdownNames.map(n => (
                    <th key={n} title={n} className="py-0 border-b border-gray-400 text-center border-l border-gray-400">
                      {shortSourceName(n)}
                    </th>
                  ))}
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Physical count">CNT</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Total used across all services">USED</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Running expected stock">EXP</th>
                  <th className="py-0 border-b border-gray-400 text-center border-l border-gray-400" title="Count loss/gain on singles">L/G</th>
                </tr>
              </thead>
              <tbody>
                {packChainRows.map((row) => {
                  const omissions = packChainOmissionsByDate.get(row.date) ?? []
                  return (
                  <tr key={row.date} className={`border-b border-gray-200 ${(row.singlesLoss ?? 0) > 0.001 || (row.packLoss ?? 0) > 0.001 ? 'bg-red-50' : omissions.length > 0 ? 'bg-orange-50' : 'bg-white'}`}>
                    <td className="pl-0.5 py-0 font-bold text-gray-500 whitespace-nowrap sticky left-0 bg-inherit">
                      {onDateClick ? (
                        <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                          {fmtDate(row.date)}
                        </button>
                      ) : fmtDate(row.date)}
                    </td>
                    <td className="text-center py-0 leading-none font-bold border-l-2 border-l-gray-600 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.packCnt} countedBy={row.packCntBy} countedAt={row.packCntAt} history={row.packCntHistory} />
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-blue-600">{fmtQs(row.packBl.toString())}</td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packGmc.toString())}</td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtQs(row.packWic.toString())}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.packExp)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.packLoss === null ? <span className="text-gray-300">—</span>
                        : row.packLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.packLoss)}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.packLoss !== null && row.packLoss < -0.001
                        ? <span className="bg-red-600 text-white rounded px-0.5" title="A gain should never happen — a record is missing (unrecorded bill, wrong GMC, or an earlier count error). See OMISSIONS.">⚠+{fmtN(Math.abs(row.packLoss))}</span>
                        : row.packLoss === null ? <span className="text-gray-300">—</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 text-teal-600">{fmtQs(row.singlesConvIn.toString())}</td>
                    {(() => {
                      const { singlesBreakdown } = row
                      return (
                        <>
                          <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-600 whitespace-nowrap">
                            {breakdownNames.length > 0 ? singlesBreakdown.reduce((s, b) => s + b.qty, 0) : fmtQ(row.singlesUsed)}
                          </td>
                          <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.singlesExp)}</td>
                          <td className="text-center py-0 font-bold border-l border-gray-300">
                            {row.singlesLoss === null ? <span className="text-gray-300">—</span>
                              : row.singlesLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.singlesLoss)}</span>
                              : <span className="text-gray-400">0</span>}
                          </td>
                        </>
                      )
                    })()}
                    {packChainBreakdownNames.map(n => {
                      const b = row.singlesBreakdown.find(x => x.name === n)
                      const qty = b?.qty ?? 0, amount = b?.amount ?? 0
                      return (
                        <td key={n} className="text-center py-0 font-bold border-l border-gray-300 text-gray-600 whitespace-nowrap overflow-hidden">
                          {qty === 0 ? '—' : <>{fmtQ(qty)}<span className="text-blue-500 text-[6px]"> (₵{fmtN(amount)})</span></>}
                        </td>
                      )
                    })}
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.singlesCnt} countedBy={row.singlesCntBy} countedAt={row.singlesCntAt} history={row.singlesCntHistory} />
                    </td>
                    <td className="text-center py-0 leading-none font-bold border-l border-gray-300 text-gray-600">{fmtN(row.singlesUsed)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300 text-gray-400">{fmtN(row.singlesExp)}</td>
                    <td className="text-center py-0 font-bold border-l border-gray-300">
                      {row.singlesLoss === null ? <span className="text-gray-300">—</span>
                        : row.singlesLoss > 0.001 ? <span className="text-red-600">-{fmtN(row.singlesLoss)}</span>
                        : row.singlesLoss < -0.001 ? <span className="text-green-600">+{fmtN(Math.abs(row.singlesLoss))}</span>
                        : <span className="text-gray-400">0</span>}
                    </td>
                    <td className="text-center py-0 font-bold border-l-2 border-l-gray-600 whitespace-nowrap">
                      {(() => {
                        const cedis = rowLossCedis(row, numVal(item.units_per_pack), sheetPrice)
                        if (cedis === null) return <span className="text-gray-300">—</span>
                        if (cedis > 0.001) return <span className="text-red-600">-₵{fmtN(cedis)}</span>
                        if (cedis < -0.001) return <span className="text-green-600">+₵{fmtN(Math.abs(cedis))}</span>
                        return <span className="text-gray-400">0</span>
                      })()}
                    </td>
                    <td className="pl-1 py-0 border-l-2 border-l-gray-600 text-purple-700 font-semibold overflow-hidden whitespace-nowrap">
                      <span className="block truncate" title={row.packAliases ?? ''}>{row.packAliases ?? <span className="text-gray-300">—</span>}</span>
                    </td>
                    <td className="pl-1 py-0 border-l border-gray-300 text-purple-700 font-semibold overflow-hidden whitespace-nowrap">
                      <span className="block truncate" title={row.singlesAliases ?? ''}>{row.singlesAliases ?? <span className="text-gray-300">—</span>}</span>
                    </td>
                  </tr>
                  )
                })}
                {(() => {
                  const totalCedis = packChainRows.reduce((s, r) => s + (rowLossCedis(r, numVal(item.units_per_pack), sheetPrice) ?? 0), 0)
                  return (
                    <tr className="bg-gray-100 border-t-2 border-gray-400 font-bold">
                      <td colSpan={9} className="text-right pr-1 py-0 text-gray-600 text-[7px]">
                        {`over ${closedCycles.length} closed pack${closedCycles.length === 1 ? '' : 's'} →`}
                      </td>
                      <td className="border-l border-gray-300" />
                      <td className="text-center py-0 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets given but never recorded as used, over all closed pack cycles">
                        {cycleLossTotal > 0.001 ? <span className="text-red-600">-₵{fmtN(cycleLossTotal * sheetPrice)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="text-center py-0 border-l border-gray-300 whitespace-nowrap"
                        title="Total sheets used beyond what packs gave — should be 0">
                        {cycleGainTotal > 0.001 ? <span className="bg-red-600 text-white rounded px-0.5">⚠+{fmtQ(cycleGainTotal)}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td colSpan={4 + packChainBreakdownNames.length} className="text-right pr-1 py-0 text-gray-600">
                        TOTAL (net of gains)
                      </td>
                      <td className="text-center py-0 border-l-2 border-l-gray-600 whitespace-nowrap">
                        {totalCedis > 0.001 ? <span className="text-red-600">-₵{fmtN(parseFloat(totalCedis.toFixed(2)))}</span>
                          : totalCedis < -0.001 ? <span className="text-green-600">+₵{fmtN(Math.abs(parseFloat(totalCedis.toFixed(2))))}</span>
                          : <span className="text-gray-400">0</span>}
                      </td>
                      <td className="border-l-2 border-l-gray-600" />
                      <td className="border-l border-gray-300" />
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </>
        )
      ) : computed!.length === 0 ? (
        <p className="text-sm text-gray-400 text-center py-6">No activity.</p>
      ) : showBreakdown ? (
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
            {item.item_name} <span className="text-gray-400 font-normal">(ID: {item.item_id})</span>
          </p>
          <div className={`overflow-x-auto rounded-b-lg ${maxRows ? 'overflow-y-auto max-h-96' : ''}`}>
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-200">
                <th className="pl-3 pr-4 py-2.5 text-left whitespace-nowrap sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Date</th>
                <th className="px-4 py-2.5 text-right" title="Physical count taken that day">Cnt</th>
                <th className="px-4 py-2.5 text-right" title="Converted in from another item's GMC take">CNV</th>
                <th className="px-4 py-2.5 text-right text-blue-500" title="Available = previous stock + bills received + converted in">Avail</th>
                {breakdownNames.map(n => (
                  <th key={n} title={n} className="px-4 py-2.5 text-right">
                    {shortSourceName(n)}
                  </th>
                ))}
                <th className="px-4 py-2.5 text-right text-blue-500" title="Used = sold/consumed that day">Used</th>
                <th className="px-4 py-2.5 text-right" title="Expected = Available − Used">Exp</th>
                <th className="px-4 py-2.5 text-right" title="Count Loss = Expected − actual count (only on count days)">Loss</th>
                <th className="px-4 py-2.5 text-right" title="Loss valued at selling price">₵</th>
                <th className="px-4 py-2.5 text-right" title="Direct GMC (internal use) on this item itself">GMC</th>
                <th className="px-4 py-2.5 text-right" title="Average direct sale price that day">SP</th>
                <th className="px-4 py-2.5 text-right" title="Direct bills/purchases received">BL</th>
                <th className="px-4 py-2.5 text-left">Alias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedRows!.map((row) => {
                const lossVal = row.loss !== null ? row.loss * sp : null
                return (
                  <tr key={row.date} className={`group transition-colors ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}>
                    <td className={`pl-3 pr-4 py-2 text-gray-700 font-medium whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50 group-hover:bg-red-100/70' : 'bg-white group-hover:bg-gray-50'}`}>
                      {onDateClick ? (
                        <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                          {fmtDate(row.date)}
                        </button>
                      ) : fmtDate(row.date)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.qty_counted || null} countedBy={row.counted_by} countedAt={row.counted_at} history={row.count_history} />
                    </td>
                    <td className="px-4 py-2 text-right text-teal-600">{fmtQs(row.converted_in_qty)}</td>
                    <td className="px-4 py-2 text-right font-semibold text-blue-700">{fmtN(row.available)}</td>
                    {breakdownNames.map(n => (
                      <td key={n} className="px-4 py-2 text-right text-gray-600">
                        {fmtQ(row.wic_breakdown?.find(b => b.name === n)?.qty ?? 0)}
                      </td>
                    ))}
                    <td className="px-4 py-2 text-right font-semibold text-blue-700">{fmtN(row.available - (row.wic_breakdown?.reduce((s, b) => s + b.qty, 0) ?? 0))}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{fmtN(row.expected_soh ?? 0)}</td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${row.loss !== null && row.loss > 0.001 ? 'text-red-600' : 'text-gray-400'}`}>
                      {row.loss === null ? '—' : fmtN(row.loss)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${lossVal !== null && lossVal > 0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                      {lossVal === null ? '—' : fmtCcy(lossVal.toString())}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmtQs(row.gmc_qty)}</td>
                    <td className="px-4 py-2 text-right text-blue-500">{fmtCcy(row.sell_price)}</td>
                    <td className="px-4 py-2 text-right text-blue-600">{fmtQs(row.bills_qty)}</td>
                    <td className="px-4 py-2 text-left">
                      <span className="block truncate max-w-[180px]" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="pl-3 pr-4 py-2.5 text-gray-600 sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Total</td>
                <td colSpan={5 + breakdownNames.length} />
                <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
                <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
                <td colSpan={4} />
              </tr>
            </tfoot>
          </table>
          {hasMoreRows && (
            <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              ...and {computed!.length - maxRows!} more rows
            </div>
          )}
          </div>
        </div>
      ) : (
        <div>
          <p className="px-4 py-2 text-sm font-semibold text-gray-700 bg-gray-50 border-b border-gray-200">
            {item.item_name} <span className="text-gray-400 font-normal">(ID: {item.item_id})</span>
          </p>
          <div className={`overflow-x-auto rounded-b-lg ${maxRows ? 'overflow-y-auto max-h-96' : ''}`}>
          <table className="w-full border-collapse text-sm tabular-nums">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[11px] font-semibold uppercase tracking-wide border-b border-gray-200">
                <th className="pl-3 pr-4 py-2.5 text-left whitespace-nowrap sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Date</th>
                <th className="px-4 py-2.5 text-right">₵</th>
                <th className="px-4 py-2.5 text-right">L/G</th>
                <th className="px-4 py-2.5 text-right">Cnt</th>
                <th className="px-4 py-2.5 text-right">WIC</th>
                <th className="px-4 py-2.5 text-right">GMC</th>
                <th className="px-4 py-2.5 text-right">SP</th>
                <th className="px-4 py-2.5 text-right">BL</th>
                <th className="px-4 py-2.5 text-right" title="Converted in from another item's GMC take">CNV</th>
                <th className="px-4 py-2.5 text-right">Exp</th>
                <th className="px-4 py-2.5 text-left">Alias</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {displayedRows!.map((row) => {
                const lossVal = row.loss !== null ? row.loss * sp : null
                return (
                  <tr key={row.date} className={`group transition-colors ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50 hover:bg-red-100/70' : 'hover:bg-gray-50'}`}>
                    <td className={`pl-3 pr-4 py-2 text-gray-700 font-medium whitespace-nowrap sticky left-0 z-10 border-r border-gray-200 ${row.loss !== null && row.loss > 0.001 ? 'bg-red-50 group-hover:bg-red-100/70' : 'bg-white group-hover:bg-gray-50'}`}>
                      {onDateClick ? (
                        <button onClick={() => onDateClick(row.date, item.item_name)} className="text-blue-600 hover:underline">
                          {fmtDate(row.date)}
                        </button>
                      ) : fmtDate(row.date)}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${lossVal !== null && lossVal > 0.01 ? 'text-red-600' : 'text-gray-400'}`}>
                      {lossVal === null ? '—' : fmtCcy(lossVal.toString())}
                    </td>
                    <td className={`px-4 py-2 text-right font-semibold tabular-nums ${row.loss !== null && row.loss > 0.001 ? 'text-red-600' : 'text-gray-400'}`}>
                      {row.loss === null ? '—' : fmtN(row.loss)}
                    </td>
                    <td className="px-4 py-2 text-right text-gray-900 whitespace-nowrap">
                      <CntValue qty={row.qty_counted || null} countedBy={row.counted_by} countedAt={row.counted_at} history={row.count_history} />
                    </td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmtQs(row.wic_qty)}</td>
                    <td className="px-4 py-2 text-right text-gray-600">{fmtQs(row.gmc_qty)}</td>
                    <td className="px-4 py-2 text-right text-blue-500">{fmtCcy(row.sell_price)}</td>
                    <td className="px-4 py-2 text-right text-blue-600">{fmtQs(row.bills_qty)}</td>
                    <td className="px-4 py-2 text-right text-teal-600">{fmtQs(row.converted_in_qty)}</td>
                    <td className="px-4 py-2 text-right text-gray-400">{fmtN(row.expected_soh ?? 0)}</td>
                    <td className="px-4 py-2 text-left">
                      <span className="block truncate max-w-[180px]" title={row.aliases ?? ''}>{row.aliases ?? <span className="text-gray-300">—</span>}</span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-gray-300 bg-gray-50 font-bold">
                <td className="pl-3 pr-4 py-2.5 text-gray-600 sticky left-0 z-10 bg-gray-50 border-r border-gray-200">Total</td>
                <td className={lgCls}>{totalCost > 0.01 ? `-₵${fmtN(totalCost)}` : totalCost < -0.01 ? `+₵${fmtN(Math.abs(totalCost))}` : '0'}</td>
                <td className={lgCls}>{totalLoss > 0.001 ? `-${fmtN(totalLoss)}` : totalLoss < -0.001 ? `+${fmtN(Math.abs(totalLoss))}` : '0'}</td>
                <td colSpan={8} />
              </tr>
            </tfoot>
          </table>
          {hasMoreRows && (
            <div className="px-4 py-1.5 text-xs text-gray-400 bg-gray-50 border-t border-gray-100">
              ...and {computed!.length - maxRows!} more rows
            </div>
          )}
          </div>
        </div>
      )}
    </div>
  )
}