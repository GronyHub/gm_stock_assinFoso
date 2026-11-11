'use client'
import { matchDest, type Dest } from '@/lib/voiceCommands'
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CATEGORY_KEYWORDS, DAY_CODES, DAY_NAMES, LAW_CATEGORIES, LAW_FREQUENCIES, LAW_TYPES, PROOFS, UNCATEGORISED, scheduleText } from '@/lib/lawCategories'
import CustomerServiceCode from '../item/_components/CustomerServiceCode'
import CategoryTraining, { hasTraining, useQuizMine } from './CategoryTraining'
import GuideVideo from '@/components/GuideVideo'
import { ASSIGNMENTS } from '@/lib/assignment'
import { LAW_AREAS, lawInArea, areaForCategory, type LawArea } from '@/lib/lawAreas'
import { whyFor, whyForArea, type Why } from '@/lib/lawWhy'
import { AREA_VIDEO, fmtTime, lawTime, findChapter } from '@/lib/lawVideo'
import { LIVE_SALE_FLAGS } from '@/lib/flagGuide'
import { parseViolations, type Violation } from '@/lib/lawViolations'
import { isManagerName } from '@/lib/signers'
import DailyChecklistClient from '../standards/DailyChecklistClient'
import { TOPICS } from '../item/_components/trainingTopics'

type Law = {
  id: number; text: string; scope_key: string; category: string | null; subcategory: string | null; law_type: string
  days: string | null; law_time: string | null; frequency: string | null; minutes: number | null; dos: string | null; donts: string | null
  status?: string; kept?: { done: number; of: number; last: string | null; missed_last: boolean }; tile_id?: number | null; proof?: string; assignment?: string; points?: number; code?: string | null; title?: string | null; audience?: string; reminder?: string; quiz_n?: number; violations?: string | null; not_violation?: string | null
}
type Draft = { id?: number; text: string; category: string; subcategory: string; law_type: string; days: string[]; law_time: string; frequency: string; minutes: string; dos: string; donts: string; proof: string; assignment: string; points: string; violations: { text: string; points: string; by: string; how?: string; chapter?: string; record?: string; dismissal?: boolean }[]; not_violation: string; title: string; audience: string; reminder: string }
const json = { 'Content-Type': 'application/json' }
const typeLabel = (k: string) => LAW_TYPES.find(t => t.key === k)?.label ?? k
const typeCls: Record<string, string> = { recurring: 'bg-indigo-100 text-indigo-800', standing: 'bg-gray-100 text-gray-700', app: 'bg-sky-100 text-sky-800' }
const inp = 'w-full rounded-xl border border-gray-300 p-2.5 text-sm'
const lab = 'mb-0.5 block text-[11px] font-bold uppercase text-gray-500'
const COLS = 'grid-cols-[0.85fr_1.2fr_1.05fr_0.85fr_0.5fr_1.1fr_1fr_0.55fr_repeat(4,40px)]'
const HEAD = ['Law', 'Type and when', 'A violation is', 'How it is recorded', 'Points', 'How', 'Why', 'Quiz']
const typeName = (t: string) => t === 'recurring' ? 'Recurring task' : t === 'app' ? 'App-enforced' : 'Standing order'
const recordText = (l: { law_type: string }, v: Violation) => v.record ?? (l.law_type === 'recurring' ? 'App: task left undone at day end' : l.law_type === 'app' || v.by === 'app' ? 'App checks it' : 'A manager or superior logs it: seen in the shop or on the CCTV')
const SIGN_NAMES: Record<string, string> = { grony: 'Gro', bino: 'Bin', joe: 'Joe', james: 'Jam' }
const firstSentence = (t: string) => { const one = t.replace(/\s+/g, ' ').trim(); const m = one.match(/^(.{15,90}?)[.:!?](\s|$)/); return m ? m[1] : one.slice(0, 80) }
const lines = (s: string | null) => (s ?? '').split('\n').map(x => x.trim()).filter(Boolean)
const toDraft = (l: Law): Draft => ({ id: l.id, text: l.text, category: l.category ?? '', subcategory: l.subcategory ?? '', law_type: l.law_type, days: l.days ? l.days.split(',') : [], law_time: l.law_time ?? '', frequency: l.frequency ?? '', minutes: l.minutes ? String(l.minutes) : '', dos: l.dos ?? '', donts: l.donts ?? '', proof: l.proof ?? 'tick', assignment: l.assignment ?? 'all', points: String(l.points ?? 1), violations: parseViolations(l.violations).map(v => ({ text: v.text, points: String(v.points), by: v.by, how: v.how, chapter: v.chapter, record: v.record, dismissal: v.dismissal })), not_violation: l.not_violation ?? '', title: l.title ?? '', audience: l.audience ?? 'staff', reminder: l.reminder ?? 'none' })
const blank = (category: string): Draft => ({ text: '', category, subcategory: '', law_type: 'standing', days: [], law_time: '', frequency: '', minutes: '', dos: '', donts: '', proof: 'tick', assignment: 'all', points: '1', violations: [], not_violation: '', title: '', audience: 'staff', reminder: 'none' })

// Company Laws: category tiles, then each category's subcategories with the law, its dos and don'ts and its schedule.
export default function LawsClient({ canManage }: { canManage: boolean }) {
  const [laws, setLaws] = useState<Law[] | null>(null)
  const [error, setError] = useState('')
  const [cat, setCat] = useState<string | null>(null)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)
  const [msg, setMsg] = useState('')
  const { mine: quizMine, reload: reloadQuiz } = useQuizMine()

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/page-laws', { cache: 'no-store' }); const d = await r.json()
      if (!r.ok || !Array.isArray(d)) throw new Error(d.error ?? 'Could not load')
      setLaws(d); setError('')
    } catch (e) { setError((e as Error).message) }
  }, [])
  useEffect(() => { void load() }, [load])
  const [sig, setSig] = useState<{ signed: Record<number, string>; unsigned: number; me?: string; signer?: boolean; manager?: boolean; staff?: string[]; by?: Record<string, number[]>; marks?: Record<string, Record<number, string>> } | null>(null)
  const [signOnly, setSignOnly] = useState(false)
  // Three lenses on the same laws: by topic, Today (the recurring laws by day and time, with their ticks) and by type and when.
  const [view, setView] = useState<'topic' | 'today' | 'type'>('topic')
  const vref = useRef<HTMLVideoElement | null>(null)
  const [targets, setTargets] = useState<string[]>([])
  const [logFor, setLogFor] = useState<{ law: Law; vi: number } | null>(null)
  useEffect(() => { fetch('/api/penalties/log-targets').then(r => r.ok ? r.json() : null).then(d => d?.targets && setTargets(d.targets)).catch(() => {}) }, [])
  const [openCh, setOpenCh] = useState<number | null>(null)
  const [whyOpen, setWhyOpen] = useState<Set<number>>(new Set())
  const [quizFor, setQuizFor] = useState<Law | null>(null)
  const TimeChip = ({ t, label }: { t: number | null; label?: string }) => t === null ? <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">not in the video yet</span> : <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); seek(t) }} className="ml-2 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">▶ {fmtTime(t)}{label ? ` ${label}` : ''}</button>
  function seek(t: number) {
    const v = vref.current; if (!v) return
    v.scrollIntoView({ behavior: 'smooth', block: 'center' }); v.currentTime = t; void v.play().catch(() => {})
  }
  const loadSig = useCallback(() => fetch('/api/law-signatures', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => d && setSig(d)).catch(() => {}), [])
  useEffect(() => { void loadSig() }, [loadSig])
  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const t = q.get('tile'), c = q.get('cat')
    if (q.get('view') === 'today') setView('today'); else if (q.get('view') === 'type') setView('type')
    if (t && q.get('view') !== 'today') setCat(t); else if (c) { const a = areaForCategory(c); setCat(a ? a.key : c) }
    if (q.get('sign')) setSignOnly(true)
  }, [])

  // Waiting for me opens the exact law: /laws?law=ID (&quiz=1 opens its quiz straight away)
  const deepLaw = useRef(false)
  useEffect(() => {
    if (deepLaw.current || !laws) return
    const q = new URLSearchParams(window.location.search); const id = Number(q.get('law'))
    deepLaw.current = true
    if (!id) return
    const l = laws.find(x => x.id === id); if (!l) return
    const a = l.category ? areaForCategory(l.category) : null
    setView('topic'); setCat(a ? a.key : (l.category || UNCATEGORISED))
    if (q.get('quiz') && (l.quiz_n ?? 0) > 0) setQuizFor(l)
  }, [laws])
  const flash = (m: string) => { setMsg(m); setTimeout(() => setMsg(''), 3000) }
  const areas: LawArea[] = useMemo(() => {
    const list = LAW_AREAS.filter(a => canManage || !a.ownerOnly)
    const unc = (laws ?? []).some(l => !l.category)
    return canManage && unc ? [...list, { key: UNCATEGORISED, group: 'Grony Manage' as const, label: UNCATEGORISED, icon: '❓', blurb: 'Laws added the old way. Give each a category.', match: [] }] : list
  }, [canManage, laws])
  // Voice (the microphone in the hub): a spoken sentence is matched to a tile name first, then to a law's name or code, which opens the search for it.
  useEffect(() => {
    const h = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.data?.type !== 'page-voice') return
      const text = String(e.data.text ?? '')
      const dests: Dest[] = areas.map(a => ({ label: a.label, names: [a.label, ...a.label.split('/').map(x => x.trim())], run: () => setCat(a.key) }))
      const tile = matchDest(text, dests)
      if (tile) { tile.run(); window.parent.postMessage({ type: 'page-voice-result', handled: true, message: `Opened ${tile.label}` }, window.location.origin); return }
      const said = text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter(w => w.length > 2)
      const hit = said.length ? (laws ?? []).some(l => said.every(w => `${l.code ?? ''} ${l.title ?? ''} ${l.text}`.toLowerCase().includes(w))) : false
      if (hit) { setCat(null); setQ(text); window.parent.postMessage({ type: 'page-voice-result', handled: true, message: `Searching laws for "${text}"` }, window.location.origin); return }
      window.parent.postMessage({ type: 'page-voice-result', handled: false }, window.location.origin)
    }
    window.addEventListener('message', h)
    return () => window.removeEventListener('message', h)
  }, [areas, laws])
  const areaLaws = (a: LawArea) => (laws ?? []).filter(l => a.key === UNCATEGORISED ? !l.category : lawInArea(a, l))
  const unsignedIn = (a: LawArea) => areaLaws(a).filter(l => l.status !== 'draft' && !(sig?.signed ?? {})[l.id])
  useEffect(() => {
    if (!signOnly || !sig || !laws || cat) return
    const first = areas.find(a => unsignedIn(a).length > 0)
    if (first) setCat(first.key)
    setSignOnly(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signOnly, sig, laws])
  const tiles = areas
  const searching = q.trim().length > 1
  const hits = searching ? (laws ?? []).filter(l => (l.text + ' ' + (l.subcategory ?? '') + ' ' + (l.dos ?? '') + ' ' + (l.donts ?? '')).toLowerCase().includes(q.trim().toLowerCase())) : []

  async function remove(l: Law) {
    if (!confirm('Delete this law? It disappears from Company Laws and the page it was written on.')) return
    const r = await fetch(`/api/page-laws/${l.id}`, { method: 'DELETE' })
    if (r.ok) { flash('Law deleted'); void load() } else flash('Could not delete')
  }

  async function approve(body: { id?: number; category?: string }) {
    const r = await fetch('/api/page-laws/approve', { method: 'POST', headers: json, body: JSON.stringify(body) }); const d = await r.json().catch(() => ({}))
    if (r.ok) { flash(d.approved ? `Approved ${d.approved}. Tiles are in the Daily Checklist.` : 'Tiles created'); void load() } else flash(d.error ?? 'Could not approve')
  }

  async function signLaws(ids: number[]) {
    const r = await fetch('/api/law-signatures', { method: 'POST', headers: json, body: JSON.stringify({ ids }) })
    if (r.ok) { flash(ids.length > 1 ? 'Signed. Thank you.' : 'Signed'); void loadSig() } else flash('Could not sign')
  }
  const WhyBox = ({ w }: { w: Why }) => (
    <div className="mt-2 space-y-1 rounded-lg bg-blue-50 p-2 text-[12px] text-gray-800">
      <p><b>Why it exists:</b> {w.exists}</p><p><b>What it solves:</b> {w.solves}</p><p><b>How it helps the business:</b> {w.helps}</p><p className="text-red-800"><b>If it is not done:</b> {w.loss}</p>
    </div>
  )
  const FlagList = ({ av }: { av?: (typeof AREA_VIDEO)[string] }) => (
    <div className="mt-2 space-y-1 rounded-xl border border-red-200 bg-red-50 p-2">
      <p className="px-1 text-xs font-extrabold uppercase tracking-wide text-red-800">🚩 Every flag and how to fix it{av && <TimeChip t={findChapter(av, 'Now, flags')?.t ?? null} />}</p>
      {LIVE_SALE_FLAGS.map(f => (
        <details key={f.key} className="rounded-lg bg-white">
          <summary className="cursor-pointer px-2 py-1.5 text-sm font-semibold text-gray-900">🚩 {f.label}{av && <TimeChip t={(findChapter(av, '^Flag: ' + f.label) ?? findChapter(av, 'Now, flags'))?.t ?? null} />}</summary>
          <div className="space-y-1 p-2 text-[13px] text-gray-800">
            <p><b>What it means:</b> {f.means}</p><p><b>Why it matters:</b> {f.why}</p>
            <p><b>How to fix it:</b></p><ol className="list-decimal pl-5">{f.fix.map((x, i) => <li key={i}>{x}</li>)}</ol>
          </div>
        </details>
      ))}
    </div>
  )

  const LawCard = ({ l }: { l: Law }) => {
    const sched = scheduleText(l)
    const why = whyFor(l.category, l.subcategory)
    const signedAt = (sig?.signed ?? {})[l.id]
    const av = area ? AREA_VIDEO[area.key] : undefined
    const vlines: Violation[] = parseViolations(l.violations)
    return (
      <div className={`min-w-[980px] overflow-hidden rounded-xl border ${l.status === 'draft' ? 'border-amber-300 bg-amber-50' : 'border-gray-300 bg-white'}`}>
        {l.status === 'draft' && <p className="px-2 pt-1.5 text-[10px] font-extrabold uppercase text-amber-700">Draft: not in force yet. Read it, edit if needed, then approve.</p>}
        <div className={`grid ${COLS}`}>
          <div className="border-r border-gray-200 p-1.5" style={{ gridRow: `span ${Math.max(1, vlines.length)}` }}>
            {l.code && <span className="mb-0.5 inline-block rounded bg-[#14213D] px-1 py-px text-[9px] font-extrabold text-white">{l.code}</span>}
            <p className="text-[11px] font-extrabold leading-snug text-[#14213D]">{l.title || firstSentence(l.text)}</p>
            {canManage && <div className="mt-1 flex gap-1">
              {l.status === 'draft' && <button type="button" onClick={() => void approve({ id: l.id })} title="Approve" className="rounded bg-green-600 px-1.5 py-0.5 text-[10px] font-bold text-white">✓</button>}
              <button type="button" onClick={() => setDraft(toDraft(l))} title="Edit" className="rounded bg-blue-50 px-1.5 py-0.5 text-[10px] font-bold text-blue-700">✎</button>
              <button type="button" onClick={() => void remove(l)} title="Delete" className="rounded bg-red-50 px-1.5 py-0.5 text-[10px] font-bold text-red-700">🗑</button>
            </div>}
          </div>
          <div className="space-y-1 border-r border-gray-200 p-1.5" style={{ gridRow: `span ${Math.max(1, vlines.length)}` }}>
            <span className={`inline-block rounded-full px-1.5 py-0.5 text-[9px] font-bold ${typeCls[l.law_type] ?? typeCls.standing}`}>{typeName(l.law_type)}</span>
            {l.law_type === 'recurring' ? (<>
              <p className={`text-[10px] leading-snug ${sched.startsWith('No schedule') ? 'text-amber-800' : 'text-indigo-800'}`}><b>🗓 When:</b> {sched || 'not set yet'}</p>
              <p className="text-[10px] leading-snug text-gray-800"><b>✅ Daily Checklist:</b> {l.assignment && l.assignment !== 'all' ? `done by ${ASSIGNMENTS.find(a => a.key === l.assignment)?.label.toLowerCase() ?? l.assignment}. ` : l.audience === 'managers' ? "a managers' tile. " : 'a tile. '}{({ tick: 'Staff tap to confirm it is done', photo: 'Staff take a photo and write a note', question: 'Staff answer All good, or Report a problem', persons: 'Staff tick each person at work' } as Record<string, string>)[l.proof ?? 'tick'] ?? 'Staff tap to confirm it is done'}. {l.tile_id ? <a href="/standards" className="font-bold text-green-800 underline">Open</a> : '(Appears once approved.)'}</p>
              {l.tile_id && l.kept && <p className="text-[10px] font-semibold leading-snug text-gray-800">{l.kept.of > 0 ? `Kept ${l.kept.done} of the last ${l.kept.of} working days${l.kept.missed_last ? ' (missed yesterday)' : ''}.` : l.kept.last ? `Last done on ${l.kept.last}.` : 'Not done in the last two weeks.'}</p>}
            </>) : l.law_type === 'app' ? (
              <p className="text-[10px] leading-snug text-gray-800"><b>⚙ In the app:</b> the app enforces it itself.</p>
            ) : (<>
              <p className="text-[10px] leading-snug text-gray-500"><b>✅ Daily Checklist:</b> none, it is not an activity.</p>
              {l.reminder === 'login' ? <p className="text-[10px] leading-snug text-gray-800"><b>🔔 In the app:</b> a reminder after login, before work starts. Staff tick once to agree.</p>
                : l.reminder === 'first_sale' ? <p className="text-[10px] leading-snug text-gray-800"><b>🔔 In the app:</b> a reminder after the first sale, and again from 13:30. Staff tick once to agree.</p>
                : <p className="text-[10px] leading-snug text-gray-500"><b>🔔 In the app:</b> no reminder yet.</p>}
            </>)}
          </div>
          <div className="border-l border-gray-200 p-1.5" style={{ gridColumn: 7, gridRow: `1 / span ${Math.max(1, vlines.length)}` }}>
            {why ? <><p className="text-[10px] leading-snug text-gray-800">{why.exists}</p><p className="mt-1 text-[10px] leading-snug text-red-800"><b>If not done:</b> {why.loss}</p></> : <span className="text-[10px] text-gray-300">-</span>}
          </div>
          <div className="flex items-center justify-center border-l border-gray-200 p-1" style={{ gridColumn: 8, gridRow: `1 / span ${Math.max(1, vlines.length)}` }}>
            {l.status !== 'draft' && (l.quiz_n ?? 0) > 0 && sig?.signer ? <button type="button" onClick={() => setQuizFor(l)} className="rounded-md bg-indigo-600 px-1.5 py-1 text-[10px] font-bold text-white">📝 Quiz {l.quiz_n}</button> : (l.quiz_n ?? 0) > 0 ? <span className="text-[10px] text-gray-500">{l.quiz_n} Qs</span> : <span className="text-[10px] text-gray-300">-</span>}
          </div>
          {(sig?.staff ?? []).map(n => {
            const done = (sig?.by?.[n] ?? []).includes(l.id)
            const mark = sig?.marks?.[n]?.[l.id]
            return (
              <div key={n} className="flex flex-col items-center justify-center gap-0.5 border-l border-gray-200" style={{ gridColumn: 9 + (sig?.staff ?? []).indexOf(n), gridRow: `1 / span ${Math.max(1, vlines.length)}` }}>
                {l.status === 'draft' || (l.audience === 'managers' && !isManagerName(n)) ? <span className="text-[9px] text-gray-300">{l.audience === 'managers' && l.status !== 'draft' ? 'n/a' : '-'}</span>
                  : <>
                    {mark && <span title={`${n}: quiz mark`} className="text-[10px] font-extrabold text-indigo-700">{mark}</span>}
                    {done ? <span title={`${n} signed`} className="text-sm font-extrabold text-green-600">✓</span>
                      : n === sig?.me ? <button type="button" onClick={() => void signLaws([l.id])} title="Sign: I have read this and will follow it" className="rounded-md bg-green-600 px-1 py-1 text-[11px] font-bold text-white">✍</button>
                      : <span className="text-[10px] text-gray-300">·</span>}
                  </>}
              </div>
            )
          })}
          {vlines.length === 0 && <p className="col-span-4 m-1.5 rounded-lg bg-amber-50 p-2 text-[11px] font-semibold text-amber-800">No violation lines yet.{canManage ? ' Edit the law and add what exactly breaks it.' : ''}</p>}
          {vlines.map((v, i) => {
            const how = v.how ? v.how.split('\n').map(x => x.trim()).filter(Boolean) : (i === 0 ? lines(l.dos) : [])
            const ch = av && v.chapter ? findChapter(av, v.chapter) : null
            const last = i === vlines.length - 1
            const shared = l.law_type === 'recurring'
            return (
              <Fragment key={i}>
                <div className="border-t border-gray-200 p-1.5"><p className="text-[11px] leading-snug text-gray-900">{v.text}</p>{l.not_violation && last && <p className="mt-1 text-[10px] leading-snug text-green-800"><b>Not a violation:</b> {l.not_violation}</p>}</div>
                <div className="space-y-1 border-t border-gray-200 p-1.5"><p className="text-[10px] leading-snug text-gray-700">{recordText(l, v)}</p>
                  {targets.length > 0 && l.status !== 'draft' && !shared && v.by === 'manager' && <button type="button" onClick={() => setLogFor({ law: l, vi: i })} className="rounded-md bg-gray-800 px-1.5 py-0.5 text-[10px] font-bold text-white">Log</button>}
                </div>
                <div className="flex flex-col items-center gap-0.5 border-t border-gray-200 p-1">
                  <span className="rounded-full bg-red-600 px-1.5 py-0.5 text-[11px] font-extrabold text-white">{v.dismissal ? 'DISMISSAL' : shared ? '⚖ shared' : v.points === 0 ? 'no penalty' : `⚖ ${v.points}`}</span>
                  {shared && <span className="text-center text-[8px] leading-tight text-gray-500">1 to 3 a day, shared by everyone clocked in</span>}
                </div>
                <div className="border-t border-gray-200 p-1.5">
                  {how.length > 0 && <ol className="list-decimal space-y-0.5 pl-3 text-[10px] leading-snug text-gray-800">{how.map((x, k) => <li key={k}>{x}</li>)}</ol>}
                  {ch && <button type="button" onClick={() => seek(ch.t)} className="mt-1 rounded-full bg-indigo-600 px-1.5 py-0.5 text-[9px] font-bold text-white">▶ {fmtTime(ch.t)}</button>}
                </div>
              </Fragment>
            )
          })}
        </div>
        {area?.flags && /^Fix flags/i.test(l.text) && <div className="px-2 pb-2"><FlagList av={av} /></div>}
      </div>
    )
  }

  const [oldTiles, setOldTiles] = useState<{ id: number; title: string; section: string; law_id: number | null; created_by: string | null; active: boolean }[]>([])
  const [pick, setPick] = useState<Set<number>>(new Set())
  useEffect(() => {
    setPick(new Set())
    if (!canManage || !cat) { setOldTiles([]); return }
    fetch('/api/daily-checks/tiles').then(r => r.ok ? r.json() : null).then(d => d?.tiles && setOldTiles(d.tiles)).catch(() => {})
  }, [cat, canManage, laws])
  const area = tiles.find(c => c.key === cat) ?? null
  const kwCat = area?.match[0]?.cat
  const kw = kwCat && CATEGORY_KEYWORDS[kwCat] ? new RegExp(CATEGORY_KEYWORDS[kwCat], 'i') : null
  const candidates = kw ? oldTiles.filter(t => t.active && !t.law_id && t.created_by === 'template' && kw.test(t.title)) : []
  async function stopPicked() {
    if (!pick.size || !confirm(`Stop ${pick.size} old tile${pick.size === 1 ? '' : 's'}? Their past records are kept and you can restore them in the Tile Manager.`)) return
    for (const id of pick) await fetch(`/api/daily-checks/${id}`, { method: 'PATCH', headers: json, body: JSON.stringify({ active: false }) })
    flash('Old tiles stopped'); setPick(new Set()); setOldTiles(o => o.map(t => pick.has(t.id) ? { ...t, active: false } : t))
  }
  const catInfo = area
  const catLaws = area ? areaLaws(area) : []
  const blankFor = (a: LawArea): Draft => ({ ...blank(a.match[0]?.cat ?? ''), subcategory: a.addSub ?? a.match[0]?.subs?.[0] ?? '' })
  const subs = Array.from(new Set(catLaws.map(l => l.subcategory ?? 'General')))

  const howtoRows = (a: LawArea, covered: (id: string) => boolean) =>
    (a.howto ?? []).map(id => TOPICS.find(t => t.id === id)).filter((t): t is (typeof TOPICS)[number] => !!t && !covered(t.id))
      .map(t => <details key={t.id} className="rounded-xl border border-gray-200 bg-white"><summary className="flex cursor-pointer items-center gap-2 p-2 text-sm font-semibold text-gray-900"><span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-500">no video</span><span><span className="mr-1 text-[10px] font-extrabold uppercase text-gray-400">How to</span>{t.title}</span></summary><div className="border-t border-gray-100 p-2">{t.body}</div></details>)

  return (
    <div className="mx-auto max-w-3xl px-3 pb-24 pt-3">
      <div className="mb-2 flex items-center gap-2">
        <a href="/item" className="text-sm text-gray-500">&larr; Back to app</a>
        <h1 className="mr-auto ml-2 text-xl font-bold text-[#14213D]">Company Laws</h1>
        {canManage && <a href="/penalties" className="text-xs font-semibold text-red-700 underline">Penalties</a>}{canManage && <a href="/cctv-review" className="ml-2 text-xs font-semibold text-red-700 underline">CCTV review</a>}
      </div>
      <div className="mb-2 grid grid-cols-3 gap-1">
        {([['today', '✅ Today'], ['topic', '📚 By topic'], ['type', '🕐 By type and when']] as const).map(([k, label]) => (
          <button key={k} type="button" onClick={() => { setView(k); setQ(''); if (k !== 'topic') setCat(null) }} className={`rounded-xl px-1 py-2 text-xs font-bold ${view === k ? 'bg-[#14213D] text-white' : 'bg-gray-100 text-gray-700'}`}>{label}</button>
        ))}
      </div>
      {view === 'today' && <DailyChecklistClient canManage={canManage} embedded />}
      {view === 'type' && laws && (() => {
        const all = laws.filter(l => l.status !== 'draft' || canManage)
        const dayKey = (l: Law) => (l.days ? l.days.split(',')[0] : '')
        const groups: [string, Law[]][] = [
          ['Daily: every day, by time', all.filter(l => l.law_type === 'recurring' && l.frequency === 'daily').sort((a, b) => (a.law_time ?? '99').localeCompare(b.law_time ?? '99') || a.id - b.id)],
          ['Weekly: by day, then time', all.filter(l => l.law_type === 'recurring' && l.frequency === 'weekly').sort((a, b) => DAY_CODES.indexOf(dayKey(a) as never) - DAY_CODES.indexOf(dayKey(b) as never) || (a.law_time ?? '99').localeCompare(b.law_time ?? '99'))],
          ['Monthly and yearly', all.filter(l => l.law_type === 'recurring' && l.frequency !== 'daily' && l.frequency !== 'weekly').sort((a, b) => (a.law_time ?? '99').localeCompare(b.law_time ?? '99') || a.id - b.id)],
          ['Standing rules: always', all.filter(l => l.law_type === 'standing')],
          ['App rules: the app checks these itself', all.filter(l => l.law_type === 'app')],
        ]
        return (
          <div className="space-y-4">
            <p className="text-[11px] text-gray-500">The same laws, arranged by type and by when they are done. Change a law here and it changes everywhere, including its task in Today.</p>
            {groups.filter(([, list]) => list.length).map(([title, list]) => (
              <div key={title}>
                <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{title} ({list.length})</p>
                <div className="space-y-2 overflow-x-auto">
                  <div className={`grid min-w-[980px] rounded-lg bg-[#14213D] px-1.5 py-1.5 text-[9px] font-extrabold uppercase text-white ${COLS}`}>{HEAD.map(h => <span key={h}>{h}</span>)}{(sig?.staff ?? ['grony', 'bino', 'joe', 'james']).map(n => <span key={n}>{n.slice(0, 3)}</span>)}</div>
                  {list.map(l => <LawCard key={l.id} l={l} />)}
                </div>
              </div>))}
          </div>)
      })()}
      {view === 'topic' && <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search all laws, for example personal number" className="mb-3 w-full rounded-xl border border-gray-300 p-2.5 text-sm" />}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!laws && !error && <p className="text-sm text-gray-400">Loading…</p>}

      {laws && view === 'topic' && searching && (
        <div className="space-y-2">
          <p className="text-[11px] text-gray-500">{hits.length} law{hits.length === 1 ? '' : 's'} found</p>
          {hits.map(l => (<div key={l.id}><button type="button" onClick={() => { setQ(''); setCat((tiles.find(a => lawInArea(a, l)) ?? { key: UNCATEGORISED }).key) }} className="mb-0.5 text-[11px] font-bold text-blue-700 underline">{l.category ?? UNCATEGORISED}{l.subcategory ? ` › ${l.subcategory}` : ''}</button><LawCard l={l} /></div>))}
        </div>
      )}

      {laws && view === 'topic' && !searching && !cat && (
        <div className="space-y-4">
          {sig?.signer && (sig?.unsigned ?? 0) > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50 p-2 text-sm font-semibold text-amber-900">✍ You have {sig?.unsigned} law{sig?.unsigned === 1 ? '' : 's'} to sign. Open a tile marked to sign and sign each law.</div>}
          {(['Grony Cash', 'Grony Manage'] as const).map(group => (
            <div key={group}>
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{group}{group === 'Grony Cash' ? ' (the sidebar pages)' : ' (running the shop)'}</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {tiles.filter(a => a.group === group).map(c => {
                  const list = areaLaws(c)
                  const sched = list.filter(l => l.law_type === 'recurring').length
                  const live = list.filter(l => l.status !== 'draft')
                  const todo = unsignedIn(c).length
                  const t = c.training && hasTraining(c.training) ? c.training : null
                  return (
                    <button key={c.key} type="button" onClick={() => setCat(c.key)} className="flex min-h-[130px] flex-col items-center rounded-2xl border-2 border-gray-200 bg-white p-3 text-center active:opacity-70">
                      <span className="text-4xl leading-none">{c.icon}</span>
                      <span className="mt-2 text-sm font-bold leading-tight text-gray-900">{c.label}</span>
                      <span className="mt-1 text-[10px] leading-tight text-gray-500">{c.blurb}</span>
                      {(t || c.video) && <span className={`mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${t && quizMine[t]?.passed ? 'bg-green-100 text-green-800' : 'bg-indigo-100 text-indigo-800'}`}>{t && quizMine[t]?.passed ? '🎬 Quiz passed' : t ? '🎬 Video + quiz' : '🎬 Video'}</span>}
                      <span className="mt-auto pt-2 text-[11px] font-bold text-[#14213D]">{live.length} law{live.length === 1 ? '' : 's'}{sched ? ` · ${sched} scheduled` : ''}</span>
                      {sig?.signer && todo > 0 && <span className="text-[10px] font-extrabold text-amber-700">✍ {todo} to sign</span>}
                      {list.some(l => l.status === 'draft') && canManage && <span className="text-[10px] font-extrabold text-amber-700">{list.filter(l => l.status === 'draft').length} draft{list.filter(l => l.status === 'draft').length === 1 ? '' : 's'} to approve</span>}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {laws && view === 'topic' && !searching && cat && area && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => setCat(null)} className="text-sm font-semibold text-blue-700">&larr; All laws</button>
            {canManage && catLaws.some(l => l.status === 'draft') && <button type="button" onClick={() => { const ds = catLaws.filter(l => l.status === 'draft'); if (confirm(`Approve all ${ds.length} draft laws in ${area.label}? Their tiles go into the Daily Checklist and the old tiles they replace are stopped.`)) void (async () => { for (const l of ds) await approve({ id: l.id }) })() }} className="ml-auto rounded-lg bg-amber-500 px-3 py-1.5 text-sm font-bold text-white">Approve all drafts ({catLaws.filter(l => l.status === 'draft').length})</button>}
            {canManage && area.key !== UNCATEGORISED && <button type="button" onClick={() => setDraft(blankFor(area))} className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-bold text-white">+ Add law</button>}
          </div>
          <div className="flex items-center gap-2"><span className="text-3xl">{area.icon}</span><div><p className="text-lg font-bold text-[#14213D]">{area.label}</p><p className="text-xs text-gray-500">{area.blurb}</p></div></div>
          {AREA_VIDEO[area.key] && area.guide ? (
            <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-2">
              <p className="px-1 text-xs font-extrabold uppercase tracking-wide text-indigo-900">🎬 {area.label}: watch, and tap any line below to jump to it</p>
              <GuideVideo page={area.guide} videoRef={vref} onEnded={() => void fetch('/api/law-video', { method: 'POST', headers: json, body: JSON.stringify({ area: area.key, label: area.label + ' video' }) }).catch(() => {})} />
              {area.training && hasTraining(area.training) && <CategoryTraining cat={area.training} result={quizMine[area.training]} onDone={() => void reloadQuiz()} hideVideo />}
            </div>
          ) : area.training && hasTraining(area.training)
            ? <CategoryTraining cat={area.training} result={quizMine[area.training]} onDone={() => void reloadQuiz()} onWatched={() => void fetch('/api/law-video', { method: 'POST', headers: json, body: JSON.stringify({ area: area.key, label: area.label + ' video' }) }).catch(() => {})} />
            : area.guide ? <div className="space-y-1 rounded-2xl border border-indigo-200 bg-indigo-50 p-2"><p className="px-1 text-xs font-extrabold uppercase tracking-wide text-indigo-900">🎬 Watch and learn: {area.label}</p><GuideVideo page={area.guide} /></div> : null}
          {!AREA_VIDEO[area.key] && area.training && hasTraining(area.training) && area.guide && (
            <details className="rounded-xl border border-indigo-200 bg-indigo-50 p-2"><summary className="cursor-pointer text-sm font-bold text-gray-900">▶ How to use this page (video)</summary><div className="mt-2"><GuideVideo page={area.guide} /></div></details>
          )}
          {sig?.signer && (() => { const todo = unsignedIn(area); return todo.length > 0 ? <button type="button" onClick={() => void signLaws(todo.map(l => l.id))} className="w-full rounded-xl bg-green-600 py-2.5 text-sm font-bold text-white">✍ I have read all {todo.length} laws here and will follow them. Sign all</button> : catLaws.some(l => l.status !== 'draft') ? <p className="rounded-xl bg-green-50 p-2 text-center text-sm font-bold text-green-800">✍ You have signed every law here.</p> : null })()}
          {AREA_VIDEO[area.key] && (() => {
            const av = AREA_VIDEO[area.key]
            const live = catLaws.filter(l => l.status !== 'draft' || canManage)
            const byTime = (list: Law[]) => [...list].sort((a, b) => (lawTime(av, a) ?? 99999) - (lawTime(av, b) ?? 99999) || a.id - b.id)
            const sorted = byTime(live.filter(l => l.audience !== 'managers')), mgrSorted = byTime(live.filter(l => l.audience === 'managers'))
            const extra = howtoRows(area, id => !!area.howtoRe?.[id] && !!findChapter(av, area.howtoRe[id]))
            return (
              <div className="space-y-2">
                <div className="space-y-2 overflow-x-auto">
                  <div className={`grid min-w-[980px] rounded-lg bg-[#14213D] px-1.5 py-1.5 text-[9px] font-extrabold uppercase text-white ${COLS}`}>{HEAD.map(h => <span key={h}>{h}</span>)}{(sig?.staff ?? ['grony', 'bino', 'joe', 'james']).map(n => <span key={n} title={n} className="text-center">{SIGN_NAMES[n] ?? n.slice(0, 3)}</span>)}</div>
                  {sorted.map(l => <LawCard key={l.id} l={l} />)}
                </div>
                {mgrSorted.length > 0 && <ManagerSection area={area} laws={mgrSorted} Card={LawCard} />}
                <details className="rounded-xl border border-gray-200 bg-white p-2">
                  <summary className="cursor-pointer text-sm font-bold text-gray-900">Video transcript, with times</summary>
                  <div className="mt-1 space-y-1">{av.chapters.map(c => (
                    <div key={c.t} className="flex items-start gap-2 text-[12px]">
                      <button type="button" onClick={() => seek(c.t)} className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-[10px] font-bold text-white">▶ {fmtTime(c.t)}</button>
                      <span><b className="text-gray-900">{c.title}.</b> <span className="text-gray-700">{c.text}</span></span>
                    </div>))}</div>
                </details>
                {extra.length > 0 && <details className="rounded-xl border border-gray-200 bg-white p-2"><summary className="cursor-pointer text-sm font-bold text-gray-900">More how to (text only, not in the video)</summary><div className="mt-1 space-y-1">{extra}</div></details>}
              </div>
            )
          })()}
          {!AREA_VIDEO[area.key] && (() => { const rows = howtoRows(area, () => false); return rows.length > 0 ? <div className="space-y-1 rounded-2xl border border-gray-200 bg-white p-2"><p className="px-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">How to</p>{rows}</div> : null })()}
          {!AREA_VIDEO[area.key] && Array.from(new Set(catLaws.filter(l => l.audience !== 'managers').map(l => l.subcategory ?? 'General'))).map(sub => (
            <div key={sub} className="overflow-x-auto">
              <p className="mb-1 text-xs font-extrabold uppercase tracking-wide text-[#14213D]">{sub}</p>
              <div className="space-y-2"><div className={`grid min-w-[980px] rounded-lg bg-[#14213D] px-1.5 py-1.5 text-[9px] font-extrabold uppercase text-white ${COLS}`}>{HEAD.map(h => <span key={h}>{h}</span>)}{(sig?.staff ?? ['grony', 'bino', 'joe', 'james']).map(n => <span key={n} title={n} className="text-center">{SIGN_NAMES[n] ?? n.slice(0, 3)}</span>)}</div>{catLaws.filter(l => l.audience !== 'managers' && (l.subcategory ?? 'General') === sub).map(l => <LawCard key={l.id} l={l} />)}</div>
            </div>
          ))}
          {!AREA_VIDEO[area.key] && catLaws.some(l => l.audience === 'managers') && <ManagerSection area={area} laws={catLaws.filter(l => l.audience === 'managers')} Card={LawCard} />}
          {canManage && candidates.length > 0 && (
            <details className="rounded-xl border border-gray-300 bg-gray-50">
              <summary className="cursor-pointer px-3 py-2 text-sm font-bold text-gray-900">Old checklist tiles that may be replaced by these laws ({candidates.length})</summary>
              <div className="space-y-1 p-2">
                <p className="text-[11px] text-gray-600">These came from the old Standards list and have no law behind them. Tick the ones the laws above now cover, then stop them. Nothing is stopped until you confirm.</p>
                <div className="max-h-72 space-y-1 overflow-y-auto">{candidates.map(t => (
                  <label key={t.id} className="flex items-start gap-2 rounded-lg bg-white p-2 text-xs"><input type="checkbox" checked={pick.has(t.id)} onChange={() => setPick(p => { const n = new Set(p); n.has(t.id) ? n.delete(t.id) : n.add(t.id); return n })} className="mt-0.5" /><span><b className="text-gray-500">{t.section}</b> · {t.title}</span></label>
                ))}</div>
                <button type="button" disabled={!pick.size} onClick={() => void stopPicked()} className="w-full rounded-xl bg-red-600 py-2 text-sm font-bold text-white disabled:opacity-40">Stop {pick.size || ''} selected tile{pick.size === 1 ? '' : 's'}</button>
              </div>
            </details>
          )}
          {catLaws.length === 0 && <p className="text-sm text-gray-400">No laws in this category yet.{canManage ? ' Use + Add law.' : ''}</p>}
        </div>
      )}

      {quizFor && <LawQuiz law={quizFor} onClose={() => setQuizFor(null)} onDone={() => { void loadSig() }} />}
      {logFor && <LogViolation target={logFor} targets={targets} onClose={() => setLogFor(null)} onDone={m => { flash(m); setLogFor(null) }} />}
      {draft && <Editor d={draft} subs={Array.from(new Set((laws ?? []).map(l => l.subcategory).filter(Boolean) as string[]))} onClose={() => setDraft(null)} onSaved={m => { flash(m); setDraft(null); void load() }} />}
      {msg && <div className="fixed bottom-5 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white">{msg}</div>}
    </div>
  )
}

function Editor({ d: start, subs, onClose, onSaved }: { d: Draft; subs: string[]; onClose: () => void; onSaved: (m: string) => void }) {
  const [d, setD] = useState<Draft>(start)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD(p => ({ ...p, [k]: v }))
  async function save() {
    if (!d.violations.some(v => v.text.trim())) { setErr('Add at least one violation: what exactly breaks this law.'); return }
    setBusy(true); setErr('')
    const r = await fetch(d.id ? `/api/page-laws/${d.id}` : '/api/page-laws', { method: d.id ? 'PUT' : 'POST', headers: json, body: JSON.stringify({ ...d, minutes: Number(d.minutes) || null, violations: d.violations.filter(v => v.text.trim()).map(v => ({ text: v.text, points: v.points === '0' ? 0 : Number(v.points) || 1, by: v.by, how: v.how, chapter: v.chapter, record: v.record, dismissal: v.dismissal })) }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(j.error ?? 'Could not save'); else onSaved(d.id ? 'Law saved' : 'Law added')
  }
  const recurring = d.law_type === 'recurring'
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-2xl space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">{d.id ? 'Edit law' : 'New law'}</p>
        <div><label className={lab}>Who sees and keeps this law</label><select value={d.audience} onChange={e => set('audience', e.target.value)} className={inp}><option value="staff">All staff</option><option value="managers">Managers and owners only</option></select></div>
        {d.law_type === 'standing' && <div><label className={lab}>App reminder (standing orders)</label><select value={d.reminder} onChange={e => set('reminder', e.target.value)} className={inp}><option value="none">No reminder</option><option value="login">After login, before work starts</option><option value="first_sale">After the staff member&apos;s first sale of the day</option></select></div>}
        <div><label className={lab}>Short title (shown in the table)</label><input value={d.title} onChange={e => set('title', e.target.value)} placeholder="For example: Record every sale as soon as it happens" className={inp} /></div>
        <div><label className={lab}>The law (full statement, used for the checklist)</label><textarea value={d.text} onChange={e => set('text', e.target.value)} rows={4} className={inp} /></div>
        <div className="grid grid-cols-2 gap-2">
          <div><label className={lab}>Category (required)</label><select value={d.category} onChange={e => set('category', e.target.value)} className={inp}><option value="" disabled>Choose…</option>{LAW_CATEGORIES.map(c => <option key={c.key}>{c.key}</option>)}</select></div>
          <div><label className={lab}>Subcategory</label><input list="law-subs" value={d.subcategory} onChange={e => set('subcategory', e.target.value)} className={inp} /><datalist id="law-subs">{subs.map(s => <option key={s} value={s} />)}</datalist></div>
        </div>
        <div><label className={lab}>Type</label>
          <div className="space-y-1">{LAW_TYPES.map(t => (
            <label key={t.key} className={`flex cursor-pointer items-start gap-2 rounded-xl border p-2 ${d.law_type === t.key ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
              <input type="radio" checked={d.law_type === t.key} onChange={() => set('law_type', t.key)} className="mt-1" /><span><b className="text-sm">{t.label}</b><span className="block text-[11px] text-gray-600">{t.help}</span></span>
            </label>))}</div></div>
        {recurring && (
          <div className="space-y-2 rounded-xl bg-gray-50 p-3">
            <div><label className={lab}>Days (none ticked = every day)</label>
              <div className="flex flex-wrap gap-1.5">{DAY_CODES.map(w => <button key={w} type="button" onClick={() => set('days', d.days.includes(w) ? d.days.filter(x => x !== w) : [...d.days, w])} className={`rounded-full px-3 py-1.5 text-xs font-bold ${d.days.includes(w) ? 'bg-[#14213D] text-white' : 'bg-white text-gray-700'}`}>{DAY_NAMES[w].slice(0, 3)}</button>)}</div></div>
            <div className="grid grid-cols-3 gap-2">
              <div><label className={lab}>How often</label><select value={d.frequency} onChange={e => set('frequency', e.target.value)} className={inp}><option value="">Choose…</option>{LAW_FREQUENCIES.map(f => <option key={f}>{f}</option>)}</select></div>
              <div><label className={lab}>Time</label><input type="time" value={d.law_time} onChange={e => set('law_time', e.target.value)} className={inp} /></div>
              <div><label className={lab}>Minutes</label><input type="number" min={1} max={240} value={d.minutes} onChange={e => set('minutes', e.target.value)} className={inp} /></div>
            </div>
            <div><label className={lab}>Who does it</label><select value={d.assignment} onChange={e => set('assignment', e.target.value)} className={inp}>{ASSIGNMENTS.map(a => <option key={a.key} value={a.key}>{a.label}</option>)}</select>
              <p className="mt-0.5 text-[10px] text-gray-500">If it is left undone at day end, the point goes to these people only.</p></div>
            <div><label className={lab}>How staff prove it</label><select value={d.proof} onChange={e => set('proof', e.target.value)} className={inp}>{PROOFS.map(p => <option key={p.key} value={p.key}>{p.label}</option>)}</select></div>
          </div>
        )}
        <div className="space-y-1 rounded-xl border border-red-200 bg-red-50 p-2">
          <label className={lab}>Violations (required): what exactly breaks this law</label>
          {d.violations.map((v, i) => (
            <div key={i} className="flex items-center gap-1">
              <input value={v.text} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, text: e.target.value } : x))} placeholder="For example: a sale is not recorded the same day" className={inp} />
              <input type="number" min={0} max={20} value={v.points} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, points: e.target.value } : x))} className={inp + ' w-14'} title="Points" />
              <select value={v.by} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, by: e.target.value } : x))} className={inp + ' w-28'}><option value="manager">Manager logs</option><option value="app">App checks</option></select>
              <label className="flex shrink-0 items-center gap-1 text-[10px] font-bold text-red-700"><input type="checkbox" checked={!!v.dismissal} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, dismissal: e.target.checked } : x))} />Dismissal</label>
              <button type="button" onClick={() => set('violations', d.violations.filter((_, j) => j !== i))} className="rounded-lg bg-white px-2 py-2 text-xs font-bold text-red-700">✕</button>
            </div>))}
          {d.violations.map((v, i) => <input key={'r' + i} value={v.record ?? ''} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, record: e.target.value } : x))} placeholder={`How violation ${i + 1} is recorded (optional)`} className={inp} />)}
          {d.violations.map((v, i) => <textarea key={'h' + i} value={v.how ?? ''} onChange={e => set('violations', d.violations.map((x, j) => j === i ? { ...x, how: e.target.value } : x))} rows={2} placeholder={`How to avoid violation ${i + 1}: one step per line`} className={inp} />)}
          <button type="button" onClick={() => set('violations', [...d.violations, { text: '', points: '1', by: 'manager' }])} className="rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-red-700">+ Add a violation</button>
          <div><label className={lab}>Not a violation (optional)</label><input value={d.not_violation} onChange={e => set('not_violation', e.target.value)} className={inp} /></div>
        </div>
        <div><label className={lab}>Penalty points if this law is broken</label><input type="number" min={0} max={20} value={d.points} onChange={e => set('points', e.target.value)} className={inp + ' w-24'} /></div>
        <div><label className={lab}>Do (one per line, optional)</label><textarea value={d.dos} onChange={e => set('dos', e.target.value)} rows={3} className={inp} /></div>
        <div><label className={lab}>Don&apos;t (one per line, optional)</label><textarea value={d.donts} onChange={e => set('donts', e.target.value)} rows={3} className={inp} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <button type="button" disabled={busy || !d.text.trim() || !d.category} onClick={() => void save()} className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white disabled:opacity-40">{busy ? 'Saving…' : 'Save law'}</button>
        <button type="button" onClick={onClose} className="w-full py-2 text-sm font-semibold text-gray-500">Cancel</button>
      </div>
    </div>
  )
}

// The manager logs a violation they saw (in the shop or on the CCTV): who, when, and a note. The law and its violation line set the points.
function LogViolation({ target, targets, onClose, onDone }: { target: { law: Law; vi: number }; targets: string[]; onClose: () => void; onDone: (m: string) => void }) {
  const v = parseViolations(target.law.violations)[target.vi]
  const [who, setWho] = useState<string[]>([])
  const [day, setDay] = useState(new Date().toISOString().slice(0, 10))
  const [note, setNote] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  async function save() {
    setBusy(true); setErr('')
    const r = await fetch('/api/penalties', { method: 'POST', headers: json, body: JSON.stringify({ staffs: who, law_id: target.law.id, violation_index: target.vi, note, day }) })
    const j = await r.json().catch(() => ({}))
    setBusy(false)
    if (!r.ok) setErr(j.error ?? 'Could not log it'); else onDone(`Logged for ${who.length} staff member${who.length === 1 ? '' : 's'}. They have been told.`)
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Log a violation</p>
        <div className="rounded-xl bg-red-50 p-2 text-sm"><b>{target.law.code ?? 'Law'}</b>: {v?.text}<br /><span className="text-xs font-bold text-red-700">⚖ {v?.points} point{v?.points === 1 ? '' : 's'}</span></div>
        <div><label className={lab}>Who did it</label>
          <div className="flex flex-wrap gap-1.5">{targets.map(t => <button key={t} type="button" onClick={() => setWho(w => w.includes(t) ? w.filter(x => x !== t) : [...w, t])} className={`rounded-full px-3 py-1.5 text-sm font-bold capitalize ${who.includes(t) ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700'}`}>{t}</button>)}</div></div>
        <div><label className={lab}>Date it happened</label><input type="date" value={day} onChange={e => setDay(e.target.value)} className={inp} /></div>
        <div><label className={lab}>What you saw (a note, with the CCTV time if you used it)</label><textarea value={note} onChange={e => setNote(e.target.value)} rows={3} className={inp} /></div>
        {err && <p className="text-sm text-red-600">{err}</p>}
        <div className="flex gap-2"><button type="button" onClick={onClose} className="flex-1 rounded-xl bg-gray-100 py-2.5 text-sm font-bold text-gray-700">Cancel</button>
          <button type="button" disabled={busy || !who.length || note.trim().length < 4} onClick={() => void save()} className="flex-1 rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Log it</button></div>
      </div>
    </div>
  )
}

// A short quiz on one law. The server marks it; the mark appears in the person's signature column.
function LawQuiz({ law, onClose, onDone }: { law: Law; onClose: () => void; onDone: () => void }) {
  const [qs, setQs] = useState<{ q: string; options: string[] }[] | null>(null)
  const [answers, setAnswers] = useState<number[]>([])
  const [res, setRes] = useState<{ score: number; total: number; results: { correct: boolean; answer: number; why: string }[] } | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch(`/api/law-quiz/law?id=${law.id}`).then(r => r.ok ? r.json() : null).then(d => d?.questions && setQs(d.questions)).catch(() => {}) }, [law.id])
  async function submit() {
    setBusy(true)
    const r = await fetch('/api/law-quiz/law', { method: 'POST', headers: json, body: JSON.stringify({ law_id: law.id, answers }) })
    const d = await r.json().catch(() => ({})); setBusy(false)
    if (r.ok) { setRes(d); onDone() }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/40" onClick={onClose}>
      <div className="mx-auto max-h-[92vh] w-full max-w-lg space-y-3 overflow-y-auto rounded-t-3xl bg-white p-4 pb-8" onClick={e => e.stopPropagation()}>
        <p className="text-base font-bold">Quiz: {law.code} {law.title}</p>
        {!qs && <p className="text-sm text-gray-400">Loading…</p>}
        {qs?.map((q, i) => (
          <div key={i}>
            <p className="text-sm font-semibold text-gray-900">{i + 1}. {q.q}</p>
            <div className="mt-1 space-y-1">{q.options.map((o, j) => {
              const r = res?.results[i]
              const cls = r ? (j === r.answer ? 'border-green-500 bg-green-50' : answers[i] === j ? 'border-red-400 bg-red-50' : 'border-gray-200') : answers[i] === j ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
              return <button key={j} type="button" disabled={!!res} onClick={() => setAnswers(a => { const n = [...a]; n[i] = j; return n })} className={`block w-full rounded-lg border-2 p-2 text-left text-[13px] text-gray-800 ${cls}`}>{o}</button>
            })}</div>
            {res && <p className="mt-1 text-[11px] text-gray-600">{res.results[i].correct ? '✓ Right. ' : '✗ '}{res.results[i].why}</p>}
          </div>
        ))}
        {res ? <p className={`rounded-xl p-2 text-center text-sm font-bold ${res.score === res.total ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>Your mark: {res.score}/{res.total}. It now shows in your signature column.</p>
          : qs && <button type="button" disabled={busy || answers.filter(a => a !== undefined).length < qs.length} onClick={() => void submit()} className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white disabled:opacity-40">Submit my answers</button>}
        <button type="button" onClick={onClose} className="w-full rounded-xl bg-gray-100 py-2 text-sm font-bold text-gray-700">Close</button>
      </div>
    </div>
  )
}

// The managers-only laws of a tile: its own heading, its own video, its own table. Staff never receive these laws at all.
function ManagerSection({ area, laws, Card }: { area: LawArea; laws: Law[]; Card: (p: { l: Law }) => React.JSX.Element }) {
  return (
    <div className="mt-4 space-y-2 rounded-2xl border-2 border-amber-400 bg-amber-50 p-2">
      <p className="rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wide text-white">👔 Managers and owners only: this section is not shown to staff</p>
      <p className="px-1 text-xs text-gray-700">{area.label}: the laws that only managers keep and enforce. {area.managerVideo ? '' : 'The managers\' video for this section is not recorded yet.'}</p>
      {area.managerVideo && <video onEnded={() => void fetch('/api/law-video', { method: 'POST', headers: json, body: JSON.stringify({ area: area.key + '-managers', label: area.label + ' managers video' }) }).catch(() => {})} src={area.managerVideo} controls playsInline preload="metadata" className="mx-auto max-h-[70vh] w-full max-w-sm rounded-xl bg-black" />}
      <div className="space-y-2 overflow-x-auto">
        <div className={`grid min-w-[980px] rounded-lg bg-[#14213D] px-1.5 py-1.5 text-[9px] font-extrabold uppercase text-white ${COLS}`}>{HEAD.map(h => <span key={h}>{h}</span>)}<span className="text-center">Gro</span><span className="text-center">Bin</span><span className="text-center">Joe</span><span className="text-center">Jam</span></div>
        {laws.map(l => <Card key={l.id} l={l} />)}
      </div>
    </div>
  )
}
