'use client'
import { useState, useEffect, useRef } from 'react'
import { ASSIGNABLE_STAFF } from './violationAssignments'

type Law = { id: number; text: string; created_at: string }

type Task = {
  id: number
  title: string
  notes?: string
  done: boolean
  created_by: string
  created_at: string
  assigned_to?: string
  completed_at?: string
  completed_by?: string
  task_type?: string
}

export type FlagLaw = {
  key: string
  label: string
  description?: string
  count: number
  onViewClick?: () => void
}

// The fixed rules for this page, as a real list -- each one its own row
// (page_laws table) instead of one freeform textarea, so PageToolIcons can
// badge the page with how many laws it actually has. Notes (PageLawsNote)
// stays a single textarea -- only Law changed shape. Optional flags prop
// appends flag laws as continuation items after regular editable laws.
export default function PageLawsList({ scopeKey, onChange, flags, isItemsLaws = false }: { scopeKey: string; onChange?: () => void; flags?: FlagLaw[]; isItemsLaws?: boolean }) {
  const [laws, setLaws] = useState<Law[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')
  const [taskForLaw, setTaskForLaw] = useState<number | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('General task')
  const [taskAssignedTo, setTaskAssignedTo] = useState('')
  const [noteForLaw, setNoteForLaw] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [menuLawId, setMenuLawId] = useState<number | null>(null)
  const menuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const [taskForFlag, setTaskForFlag] = useState<string | null>(null)
  const [taskTitleForFlag, setTaskTitleForFlag] = useState('')
  const [taskTypeForFlag, setTaskTypeForFlag] = useState('General task')
  const [taskAssignedToFlag, setTaskAssignedToFlag] = useState('')
  const [noteForFlag, setNoteForFlag] = useState<string | null>(null)
  const [noteTextForFlag, setNoteTextForFlag] = useState('')
  const [tasksByLawId, setTasksByLawId] = useState<Record<number, Task[]>>({})
  const [tasksByFlagKey, setTasksByFlagKey] = useState<Record<string, Task[]>>({})
  const [repliesByItem, setRepliesByItem] = useState<Record<string, any[]>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskType, setEditTaskType] = useState('General task')
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState('')
  const [expandedFlagDesc, setExpandedFlagDesc] = useState<string | null>(null)

  function formatDate(dateStr: string) {
    if (!dateStr) return ''
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  }

  function calculateDuration(createdAt: string, completedAt: string) {
    if (!createdAt || !completedAt) return ''
    const created = new Date(createdAt).getTime()
    const completed = new Date(completedAt).getTime()
    const ms = completed - created
    const hours = Math.floor(ms / (1000 * 60 * 60))
    const days = Math.floor(hours / 24)
    if (days > 0) return `${days}d ${hours % 24}h`
    return `${hours}h`
  }

  async function toggleTaskCompletion(taskId: number, currentDone: boolean, lawId?: number, flagKey?: string) {
    await fetch(`/api/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, done: !currentDone }),
    }).catch(() => {})
    if (lawId !== undefined) await fetchTasksForLaw(lawId)
    if (flagKey !== undefined) await fetchTasksForFlag(flagKey)
  }

  async function deleteTask(taskId: number, lawId?: number, flagKey?: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
    if (lawId !== undefined) await fetchTasksForLaw(lawId)
    if (flagKey !== undefined) await fetchTasksForFlag(flagKey)
  }

  async function fetchTasksForLaw(lawId: number) {
    try {
      const res = await fetch(`/api/tasks?lawId=${lawId}`)
      const tasks = await res.json()
      setTasksByLawId(prev => ({ ...prev, [lawId]: Array.isArray(tasks) ? tasks : [] }))
    } catch (e) {
      console.error('fetch tasks error:', e)
    }
  }

  async function fetchTasksForFlag(flagKey: string) {
    try {
      const res = await fetch(`/api/tasks?flagKey=${encodeURIComponent(flagKey)}`)
      const tasks = await res.json()
      setTasksByFlagKey(prev => ({ ...prev, [flagKey]: Array.isArray(tasks) ? tasks : [] }))
    } catch (e) {
      console.error('fetch tasks error:', e)
    }
  }

  async function fetchReplies(itemType: string, itemId: number | string) {
    try {
      const res = await fetch(`/api/replies?itemType=${itemType}&itemId=${itemId}`)
      const replies = await res.json()
      setRepliesByItem(prev => ({ ...prev, [`${itemType}-${itemId}`]: Array.isArray(replies) ? replies : [] }))
    } catch (e) {
      console.error('fetch replies error:', e)
    }
  }

  async function addReply(itemType: string, itemId: number | string) {
    if (!replyText.trim()) return
    await fetch('/api/replies', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ itemType, itemId, replyText: replyText.trim() }),
    }).catch(() => {})
    setReplyText('')
    setReplyingTo(null)
    await fetchReplies(itemType, itemId)
  }

  async function deleteReply(replyId: number, itemType: string, itemId: number | string) {
    if (!confirm('Delete this reply?')) return
    await fetch(`/api/replies/${replyId}`, { method: 'DELETE' }).catch(() => {})
    await fetchReplies(itemType, itemId)
  }

  function startEditTask(task: Task) {
    setEditingTaskId(task.id)
    setEditTaskTitle(task.title)
    setEditTaskType(task.task_type || 'General task')
    setEditTaskAssignedTo(task.assigned_to || '')
  }

  async function saveEditTask(lawId?: number, flagKey?: string) {
    if (!editTaskTitle.trim() || editingTaskId === null) return
    await fetch(`/api/tasks/${editingTaskId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editTaskTitle.trim(),
        task_type: editTaskType,
        assigned_to: editTaskAssignedTo || null,
      }),
    }).catch(() => {})
    setEditingTaskId(null)
    setEditTaskTitle('')
    setEditTaskType('General task')
    setEditTaskAssignedTo('')
    if (lawId !== undefined) await fetchTasksForLaw(lawId)
    if (flagKey !== undefined) await fetchTasksForFlag(flagKey)
  }

  function load() {
    fetch(`/api/page-laws?scopeKey=${encodeURIComponent(scopeKey)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setLaws(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }
  useEffect(() => { load() }, [scopeKey])

  async function addLaw(e: React.FormEvent) {
    e.preventDefault()
    if (!text.trim() || saving) return
    setSaving(true)
    const res = await fetch('/api/page-laws', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, text: text.trim() }),
    })
    setSaving(false)
    if (res.ok) { setText(''); load(); onChange?.() }
  }

  async function remove(id: number) {
    if (!confirm('Delete this law?')) return
    setLaws(prev => prev.filter(l => l.id !== id))
    await fetch(`/api/page-laws/${id}`, { method: 'DELETE' }).catch(() => {})
    onChange?.()
  }

  function startEdit(l: Law) {
    setEditingId(l.id)
    setEditText(l.text)
    setMenuLawId(null)
  }

  function handleLongPress(lawId: number) {
    setMenuLawId(menuLawId === lawId ? null : lawId)
  }

  function handleMouseDown(lawId: number) {
    menuTimeoutRef.current = setTimeout(() => {
      setMenuLawId(lawId)
    }, 500)
  }

  function handleMouseUp() {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
  }

  function handleTouchStart(lawId: number) {
    menuTimeoutRef.current = setTimeout(() => {
      setMenuLawId(lawId)
    }, 500)
  }

  function handleTouchEnd() {
    if (menuTimeoutRef.current) {
      clearTimeout(menuTimeoutRef.current)
      menuTimeoutRef.current = null
    }
  }

  async function saveEdit(id: number) {
    const trimmed = editText.trim()
    if (!trimmed) return
    setLaws(prev => prev.map(l => l.id === id ? { ...l, text: trimmed } : l))
    setEditingId(null)
    await fetch(`/api/page-laws/${id}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: trimmed }),
    }).catch(() => {})
  }

  async function addTaskForLaw() {
    if (!taskTitle.trim() || taskForLaw === null) return
    const lawId = taskForLaw
    await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitle.trim(),
        submenu: scopeKey,
        law_id: lawId,
        task_type: taskType,
        assigned_to: taskAssignedTo || null
      }),
    }).catch(() => {})
    setTaskTitle('')
    setTaskType('General task')
    setTaskAssignedTo('')
    setTaskForLaw(null)
    await fetchTasksForLaw(lawId)
  }

  async function addNoteForLaw() {
    if (noteForLaw === null) return
    await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind: 'note', notes: noteText.trim(), law_id: noteForLaw }),
    }).catch(() => {})
    setNoteText('')
    setNoteForLaw(null)
  }

  async function addTaskForFlag() {
    if (!taskTitleForFlag.trim() || taskForFlag === null) return
    const flagKey = taskForFlag
    await fetch('/api/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: taskTitleForFlag.trim(),
        submenu: scopeKey,
        flag_key: flagKey,
        task_type: taskTypeForFlag,
        assigned_to: taskAssignedToFlag || null
      }),
    }).catch(() => {})
    setTaskTitleForFlag('')
    setTaskTypeForFlag('General task')
    setTaskAssignedToFlag('')
    setTaskForFlag(null)
    await fetchTasksForFlag(flagKey)
  }

  async function addNoteForFlag() {
    if (noteForFlag === null) return
    await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind: 'note', notes: noteTextForFlag.trim(), flag_key: noteForFlag }),
    }).catch(() => {})
    setNoteTextForFlag('')
    setNoteForFlag(null)
  }

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  return (
    <div className={isItemsLaws ? '' : 'space-y-2'}>
      {!isItemsLaws && (
        <>
          <p className="text-[10px] text-gray-400">
            The fixed rules for this page -- rarely change, separate from the main Company Laws page.
          </p>

          <form onSubmit={addLaw} className="flex items-center gap-1.5">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a law…"
              className="flex-1 min-w-0 text-xs bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={saving || !text.trim()}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
              {saving ? '…' : 'Add'}
            </button>
          </form>
        </>
      )}

      {laws.length === 0 && (!flags || flags.length === 0) ? (
        <p className={`text-[11px] text-gray-400 text-center py-6 ${isItemsLaws ? '' : ''}`}>No laws yet.</p>
      ) : (
        <div className={`bg-white ${isItemsLaws ? 'divide-y divide-gray-100' : 'border border-gray-200 rounded-lg divide-y divide-gray-50'}`}>
          {laws.map((l, i) => (
            <div key={l.id} className={`flex items-start gap-2 ${isItemsLaws ? 'px-4 py-3' : 'px-2.5 py-2'}`} onMouseDown={() => handleMouseDown(l.id)} onMouseUp={handleMouseUp} onTouchStart={() => handleTouchStart(l.id)} onTouchEnd={handleTouchEnd}>
              <span className="shrink-0 text-[10px] font-bold text-gray-300 mt-0.5">{i + 1}</span>
              {editingId === l.id ? (
                <>
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(l.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="min-w-0 flex-1 text-xs bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={() => saveEdit(l.id)} title="Save"
                    className="shrink-0 text-green-600 hover:text-green-700 px-1 text-xs font-bold">✓</button>
                  <button onClick={() => setEditingId(null)} title="Cancel"
                    className="shrink-0 text-gray-400 hover:text-gray-600 px-1 text-xs font-bold">×</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-gray-800" style={{ wordBreak: 'break-word' }}>{l.text}</p>
                    {menuLawId === l.id && (
                      <div className="flex gap-1 mt-1 text-[10px]">
                        <button onClick={() => startEdit(l)} title="Edit" className="text-gray-500 hover:text-gray-700 font-semibold">✎ Edit</button>
                        <button onClick={() => { setReplyingTo(`law-${l.id}`); fetchReplies('law', l.id) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬 Reply</button>
                        <button onClick={() => { remove(l.id); setMenuLawId(null) }} className="text-red-500 hover:text-red-700 font-semibold">× Delete</button>
                      </div>
                    )}
                    {taskForLaw === l.id ? (
                      <div className="flex flex-col gap-1.5 mt-2 bg-blue-50 p-2 rounded border border-blue-200">
                        <input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task title…"
                          onKeyDown={e => { if (e.key === 'Enter') addTaskForLaw(); if (e.key === 'Escape') setTaskForLaw(null) }}
                          className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                        <select value={taskType} onChange={e => setTaskType(e.target.value)}
                          className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
                          <option>General task</option>
                          <option>App task</option>
                        </select>
                        <select value={taskAssignedTo} onChange={e => setTaskAssignedTo(e.target.value)}
                          className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">Assign to (optional)…</option>
                          {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <button onClick={addTaskForLaw} title="Save" className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Create Task</button>
                          <button onClick={() => setTaskForLaw(null)} title="Cancel" className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                        </div>
                      </div>
                    ) : noteForLaw === l.id ? (
                      <div className="flex flex-col gap-1 mt-1">
                        <textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Note…" rows={2}
                          onKeyDown={e => { if (e.key === 'Escape') setNoteForLaw(null) }}
                          className="flex-1 min-w-0 text-[10px] bg-gray-100 border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                        <div className="flex gap-1">
                          <button onClick={addNoteForLaw} title="Save" className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Save</button>
                          <button onClick={() => setNoteForLaw(null)} title="Cancel" className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex gap-1.5 mt-1 text-[10px]">
                          <button onClick={() => { setTaskForLaw(l.id); fetchTasksForLaw(l.id) }} title="Add task for this law" className="text-blue-500 hover:text-blue-600 font-semibold">✓ Task</button>
                          <button onClick={() => setNoteForLaw(l.id)} title="Add note for this law" className="text-amber-500 hover:text-amber-600 font-semibold">📝 Note</button>
                        </div>
                        {tasksByLawId[l.id]?.length > 0 && (
                          <div className="mt-2 space-y-1.5 text-[10px]">
                            {tasksByLawId[l.id].map(task => (
                              <div key={task.id} className={`p-1.5 rounded border ${task.done ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                                {editingTaskId === task.id ? (
                                  <div className="flex flex-col gap-1.5">
                                    <input autoFocus value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} placeholder="Task title…"
                                      onKeyDown={e => { if (e.key === 'Enter') saveEditTask(l.id); if (e.key === 'Escape') setEditingTaskId(null) }}
                                      className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400" />
                                    <select value={editTaskType} onChange={e => setEditTaskType(e.target.value)}
                                      className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
                                      <option>General task</option>
                                      <option>App task</option>
                                    </select>
                                    <select value={editTaskAssignedTo} onChange={e => setEditTaskAssignedTo(e.target.value)}
                                      className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400">
                                      <option value="">Assign to (optional)…</option>
                                      {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                                    </select>
                                    <div className="flex gap-1">
                                      <button onClick={() => saveEditTask(l.id)} className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Save</button>
                                      <button onClick={() => setEditingTaskId(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-start gap-1">
                                    <input type="checkbox" checked={task.done} onChange={() => toggleTaskCompletion(task.id, task.done, l.id)}
                                      className="mt-0.5 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-start justify-between gap-2">
                                        <p className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                                        <div className="flex gap-1 shrink-0">
                                          <button onClick={() => startEditTask(task)} title="Edit task" className="text-gray-500 hover:text-gray-700 text-[9px] font-bold">✎</button>
                                          <button onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id) }} title="Reply" className="text-blue-500 hover:text-blue-700 text-[9px] font-bold">💬</button>
                                          <button onClick={() => deleteTask(task.id, l.id)} title="Delete task" className="text-red-500 hover:text-red-700 text-[9px] font-bold">×</button>
                                        </div>
                                      </div>
                                      <div className="text-[9px] text-gray-600 mt-0.5 space-y-0.5">
                                        <p>Type: {task.task_type || 'General task'}</p>
                                        <p>Assigned {formatDate(task.created_at)} by {task.created_by}</p>
                                        {task.assigned_to && <p>To: {task.assigned_to}</p>}
                                        {task.done && task.completed_at && (
                                          <>
                                            <p>Completed {formatDate(task.completed_at)} by {task.completed_by}</p>
                                            <p>Duration: {calculateDuration(task.created_at, task.completed_at)}</p>
                                          </>
                                        )}
                                      </div>
                                    </div>
                                    {replyingTo === `task-${task.id}` && (
                                      <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                                        <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={2}
                                          onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                                          className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                                        <div className="flex gap-1">
                                          <button onClick={() => addReply('task', task.id)} className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Post</button>
                                          <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                                        </div>
                                      </div>
                                    )}
                                    {repliesByItem[`task-${task.id}`]?.length > 0 && (
                                      <div className="mt-2 space-y-1 text-[9px] border-l-2 border-gray-200 pl-2">
                                        {repliesByItem[`task-${task.id}`].map(reply => (
                                          <div key={reply.id} className="bg-gray-50 p-1.5 rounded">
                                            <div className="flex items-start justify-between gap-2">
                                              <p className="font-semibold text-gray-700">{reply.created_by}</p>
                                              <button onClick={() => deleteReply(reply.id, 'task', task.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                            </div>
                                            <p className="text-gray-600 mt-0.5">{reply.reply_text}</p>
                                            <p className="text-gray-400 mt-0.5">{formatDate(reply.created_at)}</p>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                        {replyingTo === `law-${l.id}` && (
                          <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                            <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={2}
                              onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                              className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                            <div className="flex gap-1">
                              <button onClick={() => addReply('law', l.id)} className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Post</button>
                              <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                            </div>
                          </div>
                        )}
                        {repliesByItem[`law-${l.id}`]?.length > 0 && (
                          <div className="mt-2 space-y-1 text-[9px] border-l-2 border-gray-200 pl-2">
                            {repliesByItem[`law-${l.id}`].map(reply => (
                              <div key={reply.id} className="bg-gray-50 p-1.5 rounded">
                                <div className="flex items-start justify-between gap-2">
                                  <p className="font-semibold text-gray-700">{reply.created_by}</p>
                                  <button onClick={() => deleteReply(reply.id, 'law', l.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                </div>
                                <p className="text-gray-600 mt-0.5">{reply.reply_text}</p>
                                <p className="text-gray-400 mt-0.5">{formatDate(reply.created_at)}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </>
              )}
            </div>
          ))}
          {flags && flags.map((f, i) => (
            <div key={f.key} className={`flex items-center gap-1 ${isItemsLaws ? 'px-1 py-0.5 bg-red-50/30' : 'px-1 py-0.5 bg-gray-50/50'}`}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{laws.length + i + 1}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap leading-none">
                  <p className="text-[9px] text-gray-800">{f.label}</p>
                  {f.description && (
                    <button onClick={() => setExpandedFlagDesc(expandedFlagDesc === f.key ? null : f.key)}
                      title="Show description"
                      className="text-gray-400 hover:text-gray-600 text-[8px] font-bold shrink-0">ⓘ</button>
                  )}
                  <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1 py-0 rounded text-center">{f.count}</span>
                  {f.onViewClick && (
                    <button onClick={f.onViewClick} className="text-[8px] text-blue-600 font-semibold hover:text-blue-700">
                      flags
                    </button>
                  )}
                  {!taskForFlag && !noteForFlag && (
                    <>
                      <button onClick={() => { setTaskForFlag(f.key); fetchTasksForFlag(f.key) }} title="Add task for this flag" className="text-blue-500 hover:text-blue-600 font-semibold text-[8px]">✓ Task</button>
                      <button onClick={() => setNoteForFlag(f.key)} title="Add note for this flag" className="text-amber-500 hover:text-amber-600 font-semibold text-[8px]">📝 Note</button>
                    </>
                  )}
                </div>
                {expandedFlagDesc === f.key && f.description && (
                  <p className="text-[8px] text-gray-600 leading-tight">{f.description}</p>
                )}
                {taskForFlag === f.key ? (
                  <div className="flex flex-col gap-0.5 bg-blue-50 p-1 border border-blue-200 leading-none">
                    <input autoFocus value={taskTitleForFlag} onChange={e => setTaskTitleForFlag(e.target.value)} placeholder="Task title…"
                      onKeyDown={e => { if (e.key === 'Enter') addTaskForFlag(); if (e.key === 'Escape') setTaskForFlag(null) }}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                    <select value={taskTypeForFlag} onChange={e => setTaskTypeForFlag(e.target.value)}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                      <option>General task</option>
                      <option>App task</option>
                    </select>
                    <select value={taskAssignedToFlag} onChange={e => setTaskAssignedToFlag(e.target.value)}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Assign to…</option>
                      {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                    </select>
                    <div className="flex gap-1">
                      <button onClick={addTaskForFlag} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Create</button>
                      <button onClick={() => setTaskForFlag(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                    </div>
                  </div>
                ) : noteForFlag === f.key ? (
                  <div className="flex flex-col gap-0.5">
                    <textarea autoFocus value={noteTextForFlag} onChange={e => setNoteTextForFlag(e.target.value)} placeholder="Note…" rows={1}
                      onKeyDown={e => { if (e.key === 'Escape') setNoteForFlag(null) }}
                      className="flex-1 min-w-0 text-[8px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                    <div className="flex gap-1">
                      <button onClick={addNoteForFlag} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Save</button>
                      <button onClick={() => setNoteForFlag(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                    </div>
                  </div>
                ) : (
                  <>
                    {tasksByFlagKey[f.key]?.length > 0 && (
                      <div className="space-y-0.5 text-[8px]">
                        {tasksByFlagKey[f.key].map(task => (
                          <div key={task.id} className={`p-0.5 border text-[8px] ${task.done ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}>
                            {editingTaskId === task.id ? (
                              <div className="flex flex-col gap-0.5 leading-none">
                                <input autoFocus value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} placeholder="Task…"
                                  onKeyDown={e => { if (e.key === 'Enter') saveEditTask(undefined, f.key); if (e.key === 'Escape') setEditingTaskId(null) }}
                                  className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                                <select value={editTaskType} onChange={e => setEditTaskType(e.target.value)}
                                  className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                                  <option>General</option>
                                  <option>App</option>
                                </select>
                                <select value={editTaskAssignedTo} onChange={e => setEditTaskAssignedTo(e.target.value)}
                                  className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                                  <option value="">Assign…</option>
                                  {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                                </select>
                                <div className="flex gap-0.5">
                                  <button onClick={() => saveEditTask(undefined, f.key)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">✓</button>
                                  <button onClick={() => setEditingTaskId(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start gap-0.5 leading-tight">
                                <input type="checkbox" checked={task.done} onChange={() => toggleTaskCompletion(task.id, task.done, undefined, f.key)}
                                  className="shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-start justify-between gap-2">
                                    <p className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                                    <div className="flex gap-1 shrink-0">
                                      <button onClick={() => startEditTask(task)} title="Edit task" className="text-gray-500 hover:text-gray-700 text-[9px] font-bold">✎</button>
                                      <button onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id) }} title="Reply" className="text-blue-500 hover:text-blue-700 text-[9px] font-bold">💬</button>
                                      <button onClick={() => deleteTask(task.id, undefined, f.key)} title="Delete task" className="text-red-500 hover:text-red-700 text-[9px] font-bold">×</button>
                                    </div>
                                  </div>
                                <div className="text-[9px] text-gray-600 mt-0.5 space-y-0.5">
                                  <p>Type: {task.task_type || 'General task'}</p>
                                  <p>Assigned {formatDate(task.created_at)} by {task.created_by}</p>
                                  {task.assigned_to && <p>To: {task.assigned_to}</p>}
                                  {task.done && task.completed_at && (
                                    <>
                                      <p>Completed {formatDate(task.completed_at)} by {task.completed_by}</p>
                                      <p>Duration: {calculateDuration(task.created_at, task.completed_at)}</p>
                                    </>
                                  )}
                                </div>
                                {replyingTo === `task-${task.id}` && (
                                  <div className="mt-2 bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5">
                                    <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={2}
                                      onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                                      className="flex-1 min-w-0 text-[10px] bg-white border border-gray-300 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                                    <div className="flex gap-1">
                                      <button onClick={() => addReply('task', task.id)} className="flex-1 text-green-600 hover:text-green-700 text-xs font-bold">Post</button>
                                      <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-xs font-bold">×</button>
                                    </div>
                                  </div>
                                )}
                                {repliesByItem[`task-${task.id}`]?.length > 0 && (
                                  <div className="mt-2 space-y-1 text-[9px] border-l-2 border-gray-200 pl-2">
                                    {repliesByItem[`task-${task.id}`].map(reply => (
                                      <div key={reply.id} className="bg-gray-50 p-1.5 rounded">
                                        <div className="flex items-start justify-between gap-2">
                                          <p className="font-semibold text-gray-700">{reply.created_by}</p>
                                          <button onClick={() => deleteReply(reply.id, 'task', task.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        </div>
                                        <p className="text-gray-600 mt-0.5">{reply.reply_text}</p>
                                        <p className="text-gray-400 mt-0.5">{formatDate(reply.created_at)}</p>
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
