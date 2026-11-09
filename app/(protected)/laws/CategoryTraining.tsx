'use client'
import { useEffect, useState } from 'react'
import training from '@/lib/lawTraining.json'

type T = { slug: string; video: string; related: { label: string; file: string }[]; quiz: { q: string; options: string[]; answer: number; why: string }[] }
const data = training as Record<string, T>
export type QuizMine = Record<string, { score: number; total: number; passed: boolean }>

export const hasTraining = (cat: string) => !!data[cat]

// Loads my best quiz result per category (for the tile badge and the category screen).
export function useQuizMine() {
  const [mine, setMine] = useState<QuizMine>({})
  const reload = () => fetch('/api/law-quiz', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(d => {
    if (!d?.mine) return
    const m: QuizMine = {}
    for (const r of d.mine) m[r.category] = { score: Number(r.score), total: Number(r.total), passed: !!r.passed }
    setMine(m)
  }).catch(() => {})
  useEffect(() => { void reload() }, [])
  return { mine, reload }
}

// One unit with the category's laws: the video, the related videos, and a short quiz.
export default function CategoryTraining({ cat, result, onDone, hideVideo }: { cat: string; result?: { score: number; total: number; passed: boolean }; onDone: () => void; hideVideo?: boolean }) {
  const t = data[cat]
  const [answers, setAnswers] = useState<number[]>([])
  const [shown, setShown] = useState<{ score: number; total: number; passed: boolean } | null>(null)
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => { setAnswers([]); setShown(null); setOpen(null) }, [cat])
  if (!t) return null

  async function submit() {
    setBusy(true)
    try {
      const r = await fetch('/api/law-quiz', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ category: cat, answers }) })
      const d = await r.json(); if (r.ok) { setShown(d); onDone() }
    } finally { setBusy(false) }
  }

  return (
    <div className="space-y-2 rounded-2xl border border-indigo-200 bg-indigo-50 p-2">
      {!hideVideo && <p className="px-1 text-xs font-extrabold uppercase tracking-wide text-indigo-900">🎬 Watch and learn: {cat}</p>}
      {!hideVideo && <video key={t.video} src={t.video} controls playsInline preload="metadata" className="mx-auto max-h-[70vh] w-full max-w-sm rounded-xl bg-black" />}
      {!hideVideo && t.related.length > 0 && (
        <div className="space-y-1">
          <p className="px-1 text-[11px] font-bold text-gray-600">More videos for this category</p>
          {t.related.map(v => (
            <div key={v.file} className="rounded-xl bg-white">
              <button type="button" onClick={() => setOpen(open === v.file ? null : v.file)} className="flex w-full items-center gap-2 p-2 text-left text-sm font-semibold text-gray-900">▶ <span className="flex-1">{v.label}</span><span className="text-xs text-gray-400">{open === v.file ? 'Hide' : 'Watch'}</span></button>
              {open === v.file && <video src={v.file} controls autoPlay playsInline className="mx-auto max-h-[70vh] w-full max-w-sm rounded-b-xl bg-black" />}
            </div>
          ))}
        </div>
      )}
      <details className="rounded-xl bg-white">
        <summary className="flex cursor-pointer items-center gap-2 p-2 text-sm font-bold text-gray-900">❓ Quick quiz ({t.quiz.length} questions)
          {result && <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${result.passed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>{result.passed ? 'Passed' : 'Not passed'} {result.score}/{result.total}</span>}
        </summary>
        <div className="space-y-3 p-2">
          {t.quiz.map((q, i) => (
            <div key={i}>
              <p className="text-sm font-semibold text-gray-900">{i + 1}. {q.q}</p>
              <div className="mt-1 space-y-1">
                {q.options.map((o, j) => {
                  const picked = answers[i] === j
                  const mark = shown ? (j === q.answer ? 'border-green-500 bg-green-50' : picked ? 'border-red-400 bg-red-50' : 'border-gray-200') : picked ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200'
                  return <button key={j} type="button" disabled={!!shown} onClick={() => setAnswers(a => { const n = [...a]; n[i] = j; return n })} className={`block w-full rounded-lg border-2 p-2 text-left text-[13px] text-gray-800 ${mark}`}>{o}</button>
                })}
              </div>
              {shown && <p className="mt-1 text-[11px] text-gray-600">{answers[i] === q.answer ? '✓ Right. ' : '✗ '}{q.why}</p>}
            </div>
          ))}
          {!shown && <button type="button" disabled={busy || answers.filter(a => a !== undefined).length < t.quiz.length} onClick={() => void submit()} className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-bold text-white disabled:opacity-40">Check my answers</button>}
          {shown && (
            <div className={`rounded-xl p-2 text-center text-sm font-bold ${shown.passed ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'}`}>
              {shown.passed ? `Well done. You passed: ${shown.score} of ${shown.total}.` : `You got ${shown.score} of ${shown.total}. Watch the video again and retry.`}
              <button type="button" onClick={() => { setAnswers([]); setShown(null) }} className="mt-1 block w-full text-xs font-semibold underline">Try again</button>
            </div>
          )}
        </div>
      </details>
    </div>
  )
}
