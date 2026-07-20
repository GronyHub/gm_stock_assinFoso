'use client'
import { useState, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { fmtDate } from '@/lib/fmtDate'

type Quiz = { id: number; title: string; created_by: string; created_at: string; question_count: number }
type Question = { id: number; question: string; options: string[] }
type QuizDetail = { id: number; title: string; questions: Question[] }
type Result = { question: string; options: string[]; chosen: number | null; correct_index: number; isCorrect: boolean }
type Attempt = { id: number; quiz_id: number; quiz_title: string; staff_name: string; score: number; total: number; taken_at: string }

type DraftQuestion = { question: string; options: string[]; correct_index: number }
const EMPTY_QUESTION = (): DraftQuestion => ({ question: '', options: ['', '', '', ''], correct_index: 0 })

function CreateQuizForm({ onCreated, onCancel }: { onCreated: () => void; onCancel: () => void }) {
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<DraftQuestion[]>([EMPTY_QUESTION()])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function updateQuestion(i: number, patch: Partial<DraftQuestion>) {
    setQuestions(prev => prev.map((q, idx) => idx === i ? { ...q, ...patch } : q))
  }
  function updateOption(qi: number, oi: number, val: string) {
    setQuestions(prev => prev.map((q, idx) => idx === qi ? { ...q, options: q.options.map((o, j) => j === oi ? val : o) } : q))
  }

  async function save() {
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/training/quizzes', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, questions }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error ?? 'Failed to create quiz') }
      onCreated()
    } catch (e: any) {
      setError(e.message ?? 'Failed to create quiz')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-2.5 space-y-2">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Quiz title"
        className="w-full bg-gray-50 border border-gray-200 rounded-lg px-2 py-1.5 text-xs font-semibold outline-none focus:ring-1 focus:ring-blue-400" />

      {questions.map((q, qi) => (
        <div key={qi} className="border border-gray-100 rounded-lg p-2 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <input value={q.question} onChange={e => updateQuestion(qi, { question: e.target.value })}
              placeholder={`Question ${qi + 1}`}
              className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-xs outline-none focus:ring-1 focus:ring-blue-400" />
            {questions.length > 1 && (
              <button onClick={() => setQuestions(prev => prev.filter((_, i) => i !== qi))}
                className="shrink-0 text-gray-300 hover:text-red-500 font-bold leading-none px-1">×</button>
            )}
          </div>
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-1.5">
              <input type="radio" name={`correct-${qi}`} checked={q.correct_index === oi}
                onChange={() => updateQuestion(qi, { correct_index: oi })} className="shrink-0" />
              <input value={opt} onChange={e => updateOption(qi, oi, e.target.value)}
                placeholder={`Option ${oi + 1}`}
                className="flex-1 bg-gray-50 border border-gray-200 rounded-lg px-2 py-1 text-[11px] outline-none focus:ring-1 focus:ring-blue-400" />
            </div>
          ))}
          <p className="text-[9px] text-gray-400">Select the radio button next to the correct answer.</p>
        </div>
      ))}

      <button onClick={() => setQuestions(prev => [...prev, EMPTY_QUESTION()])}
        className="w-full text-[10px] font-semibold text-blue-600 bg-blue-50 rounded-lg py-1.5 hover:bg-blue-100">
        + Add Question
      </button>

      {error && <p className="text-[10px] text-red-500">{error}</p>}
      <div className="flex items-center gap-1.5">
        <button onClick={save} disabled={saving || !title.trim()}
          className="flex-1 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
          {saving ? 'Saving…' : 'Save Quiz'}
        </button>
        <button onClick={onCancel} disabled={saving}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
          Cancel
        </button>
      </div>
    </div>
  )
}

function TakeQuiz({ quizId, onDone }: { quizId: number; onDone: () => void }) {
  const [quiz, setQuiz] = useState<QuizDetail | null>(null)
  const [answers, setAnswers] = useState<Record<number, number>>({})
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<{ score: number; total: number; results: Result[] } | null>(null)

  useEffect(() => {
    fetch(`/api/training/quizzes/${quizId}`).then(r => r.ok ? r.json() : null).then(setQuiz).catch(() => setQuiz(null))
  }, [quizId])

  async function submit() {
    if (!quiz) return
    setSubmitting(true)
    const answerArray = quiz.questions.map((_, i) => answers[i] ?? null)
    try {
      const res = await fetch(`/api/training/quizzes/${quizId}/submit`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerArray }),
      })
      const data = await res.json()
      if (res.ok) setResult(data)
    } finally {
      setSubmitting(false)
    }
  }

  if (!quiz) return <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>

  if (result) {
    return (
      <div className="space-y-2">
        <div className="bg-white border border-gray-200 rounded-lg p-3 text-center">
          <p className="text-lg font-bold text-gray-900">{result.score} / {result.total}</p>
          <p className="text-[10px] text-gray-400">Score on &quot;{quiz.title}&quot;</p>
        </div>
        {result.results.map((r, i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5">
            <p className="text-[11px] font-semibold text-gray-800">{r.question}</p>
            {r.options.map((opt, oi) => (
              <p key={oi} className={`text-[10px] pl-2 ${
                oi === r.correct_index ? 'text-green-600 font-semibold'
                : oi === r.chosen ? 'text-red-500 font-semibold' : 'text-gray-400'
              }`}>
                {oi === r.correct_index ? '✓ ' : oi === r.chosen ? '✗ ' : '· '}{opt}
              </p>
            ))}
          </div>
        ))}
        <button onClick={onDone} className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200">
          Back to Assessments
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-sm font-bold text-gray-900">{quiz.title}</p>
      {quiz.questions.map((q, qi) => (
        <div key={q.id} className="bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 space-y-1">
          <p className="text-[11px] font-semibold text-gray-800">{qi + 1}. {q.question}</p>
          {q.options.map((opt, oi) => (
            <label key={oi} className="flex items-center gap-1.5 text-[11px] text-gray-700">
              <input type="radio" name={`take-${qi}`} checked={answers[qi] === oi}
                onChange={() => setAnswers(prev => ({ ...prev, [qi]: oi }))} />
              {opt}
            </label>
          ))}
        </div>
      ))}
      <button onClick={submit} disabled={submitting || Object.keys(answers).length < quiz.questions.length}
        className="w-full text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white transition">
        {submitting ? 'Submitting…' : 'Submit'}
      </button>
    </div>
  )
}

export default function AssessmentPanel() {
  const { data: session } = useSession()
  const role = (session?.user as any)?.role ?? 'staff'
  const username = (session?.user as any)?.username ?? session?.user?.name ?? ''
  const canManage = role === 'owner' || username.toLowerCase() === 'joe'

  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [takingId, setTakingId] = useState<number | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null)

  function load() {
    Promise.all([
      fetch('/api/training/quizzes').then(r => r.ok ? r.json() : []),
      fetch('/api/training/attempts').then(r => r.ok ? r.json() : []),
    ]).then(([q, a]) => {
      setQuizzes(Array.isArray(q) ? q : [])
      setAttempts(Array.isArray(a) ? a : [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }

  useEffect(() => { load() }, [])

  async function deleteQuiz(id: number) {
    await fetch(`/api/training/quizzes/${id}`, { method: 'DELETE' })
    setConfirmDeleteId(null)
    load()
  }

  if (takingId != null) {
    return <div className="py-2 px-2"><TakeQuiz quizId={takingId} onDone={() => { setTakingId(null); load() }} /></div>
  }

  if (loading) return <p className="text-[11px] text-gray-400 text-center py-6">Loading…</p>

  return (
    <div className="py-2 px-2 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">🧪 Assessments</p>
        {canManage && !creating && (
          <button onClick={() => setCreating(true)} className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded hover:bg-blue-100">
            + New Quiz
          </button>
        )}
      </div>

      {creating && <CreateQuizForm onCreated={() => { setCreating(false); load() }} onCancel={() => setCreating(false)} />}

      {quizzes.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-6">No quizzes yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {quizzes.map(q => (
            <div key={q.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-gray-800 truncate">{q.title}</p>
                <p className="text-[9px] text-gray-400">{q.question_count} question{q.question_count !== 1 ? 's' : ''} · by <span className="capitalize">{q.created_by}</span></p>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <button onClick={() => setTakingId(q.id)} className="text-[10px] font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded px-2 py-1">
                  Take
                </button>
                {canManage && (confirmDeleteId === q.id ? (
                  <>
                    <button onClick={() => deleteQuiz(q.id)} className="text-[9px] font-bold text-white bg-red-600 rounded px-1.5 py-1">Yes</button>
                    <button onClick={() => setConfirmDeleteId(null)} className="text-[9px] font-semibold text-gray-600 bg-gray-100 rounded px-1.5 py-1">No</button>
                  </>
                ) : (
                  <button onClick={() => setConfirmDeleteId(q.id)} className="text-gray-300 hover:text-red-500 font-bold leading-none px-1">×</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wide pt-1">
        {canManage ? 'All Attempts' : 'My Attempts'}
      </p>
      {attempts.length === 0 ? (
        <p className="text-[11px] text-gray-400 text-center py-4">No attempts yet.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg divide-y divide-gray-50">
          {attempts.map(a => (
            <div key={a.id} className="px-2.5 py-1.5 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] text-gray-800 truncate">{a.quiz_title}</p>
                <p className="text-[9px] text-gray-400">
                  {canManage && <span className="capitalize">{a.staff_name}</span>}{canManage && ' · '}{fmtDate(a.taken_at)}
                </p>
              </div>
              <p className="shrink-0 text-[11px] font-bold text-gray-700">{a.score}/{a.total}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
