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
export default function PageLawsList({
  scopeKey, onChange, flags, isItemsLaws = false,
  creatingGlobalLaw, setCreatingGlobalLaw,
  globalLawText, setGlobalLawText,
  creatingGlobalTask, setCreatingGlobalTask,
  globalTaskTitle, setGlobalTaskTitle,
  globalTaskType, setGlobalTaskType,
  globalTaskAssignedTo, setGlobalTaskAssignedTo,
  creatingGlobalNote, setCreatingGlobalNote,
  globalNoteTopic, setGlobalNoteTopic,
  globalNoteText, setGlobalNoteText,
  globalNoteDate, setGlobalNoteDate,
  globalNoteTaggedStaff, setGlobalNoteTaggedStaff,
  hideZeroFlags, setHideZeroFlags,
}: {
  scopeKey: string
  onChange?: () => void
  flags?: FlagLaw[]
  isItemsLaws?: boolean
  creatingGlobalLaw?: boolean
  setCreatingGlobalLaw?: (v: boolean | ((prev: boolean) => boolean)) => void
  globalLawText?: string
  setGlobalLawText?: (v: string) => void
  creatingGlobalTask?: boolean
  setCreatingGlobalTask?: (v: boolean | ((prev: boolean) => boolean)) => void
  globalTaskTitle?: string
  setGlobalTaskTitle?: (v: string) => void
  globalTaskType?: string
  setGlobalTaskType?: (v: string) => void
  globalTaskAssignedTo?: string
  setGlobalTaskAssignedTo?: (v: string) => void
  creatingGlobalNote?: boolean
  setCreatingGlobalNote?: (v: boolean | ((prev: boolean) => boolean)) => void
  globalNoteTopic?: string
  setGlobalNoteTopic?: (v: string) => void
  globalNoteText?: string
  setGlobalNoteText?: (v: string) => void
  globalNoteDate?: string
  setGlobalNoteDate?: (v: string) => void
  globalNoteTaggedStaff?: string[]
  setGlobalNoteTaggedStaff?: (v: string[] | ((prev: string[]) => string[])) => void
  hideZeroFlags?: boolean
  setHideZeroFlags?: (v: boolean | ((prev: boolean) => boolean)) => void
}) {
  const [laws, setLaws] = useState<Law[]>([])
  const [globalTasks, setGlobalTasks] = useState<any[]>([])
  const [globalNotes, setGlobalNotes] = useState<any[]>([])
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
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null)
  const [menuGlobalTaskId, setMenuGlobalTaskId] = useState<number | null>(null)
  const [menuGlobalNoteId, setMenuGlobalNoteId] = useState<number | null>(null)
  const globalTaskMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const globalNoteMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const taskMenuTimeoutRef = useRef<NodeJS.Timeout | null>(null)

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
    onChange?.()
  }

  async function deleteTask(taskId: number, lawId?: number, flagKey?: string) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
    if (lawId !== undefined) await fetchTasksForLaw(lawId)
    if (flagKey !== undefined) await fetchTasksForFlag(flagKey)
    onChange?.()
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
    onChange?.()
  }

  async function deleteReply(replyId: number, itemType: string, itemId: number | string) {
    if (!confirm('Delete this reply?')) return
    await fetch(`/api/replies/${replyId}`, { method: 'DELETE' }).catch(() => {})
    await fetchReplies(itemType, itemId)
    onChange?.()
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
    onChange?.()
  }

  function load() {
    fetch(`/api/page-laws?scopeKey=${encodeURIComponent(scopeKey)}`)
      .then(r => r.ok ? r.json() : [])
      .then(d => { setLaws(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
    // Load global tasks for this scope
    if (isItemsLaws) {
      fetch(`/api/tasks?submenu=${encodeURIComponent(scopeKey)}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setGlobalTasks(Array.isArray(d) ? d.filter(t => !t.done) : []))
        .catch(() => {})
      fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=note`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setGlobalNotes(d?.notes ? [d] : []))
        .catch(() => {})
    }
  }

  useEffect(() => { load() }, [scopeKey])

  useEffect(() => {
    laws.forEach(law => {
      if (!tasksByLawId[law.id]) {
        fetchTasksForLaw(law.id)
      }
    })
  }, [laws])

  useEffect(() => {
    if (flags) {
      flags.forEach(flag => {
        if (!tasksByFlagKey[flag.key]) {
          fetchTasksForFlag(flag.key)
        }
      })
    }
  }, [flags])

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

  async function addGlobalLaw() {
    if (!(globalLawText ?? '').trim()) return
    try {
      const res = await fetch('/api/page-laws', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeKey, text: (globalLawText ?? '').trim() }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create law:', err)
        alert('Failed to create law. Please try again.')
        return
      }
      setGlobalLawText?.('')
      setCreatingGlobalLaw?.(false)
      load()
      onChange?.()
    } catch (e) {
      console.error('Law creation error:', e)
      alert('Error creating law. Please try again.')
    }
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

  function handleTaskMouseDown(taskId: number) {
    taskMenuTimeoutRef.current = setTimeout(() => {
      setMenuTaskId(taskId)
    }, 500)
  }

  function handleTaskMouseUp() {
    if (taskMenuTimeoutRef.current) {
      clearTimeout(taskMenuTimeoutRef.current)
      taskMenuTimeoutRef.current = null
    }
  }

  function handleTaskTouchStart(taskId: number) {
    taskMenuTimeoutRef.current = setTimeout(() => {
      setMenuTaskId(taskId)
    }, 500)
  }

  function handleTaskTouchEnd() {
    if (taskMenuTimeoutRef.current) {
      clearTimeout(taskMenuTimeoutRef.current)
      taskMenuTimeoutRef.current = null
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
    onChange?.()
  }

  async function addNoteForLaw() {
    if (noteForLaw === null) return
    await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind: 'note', notes: noteText.trim(), law_id: noteForLaw }),
    }).catch(() => {})
    setNoteText('')
    setNoteForLaw(null)
    onChange?.()
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
    onChange?.()
  }

  async function addNoteForFlag() {
    if (noteForFlag === null) return
    await fetch('/api/page-notes', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, kind: 'note', notes: noteTextForFlag.trim(), flag_key: noteForFlag }),
    }).catch(() => {})
    setNoteTextForFlag('')
    setNoteForFlag(null)
    onChange?.()
  }

  async function addGlobalTask() {
    if (!(globalTaskTitle ?? '').trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: (globalTaskTitle ?? '').trim(),
          submenu: scopeKey,
          task_type: globalTaskType ?? 'General task',
          assigned_to: globalTaskAssignedTo || null,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create task:', err)
        alert('Failed to create task. Please try again.')
        return
      }
      setGlobalTaskTitle?.('')
      setGlobalTaskType?.('General task')
      setGlobalTaskAssignedTo?.('')
      setCreatingGlobalTask?.(false)
      onChange?.()
    } catch (e) {
      console.error('Task creation error:', e)
      alert('Error creating task. Please try again.')
    }
  }

  async function addGlobalNote() {
    if (!(globalNoteText ?? '').trim()) return
    try {
      const res = await fetch('/api/page-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeKey,
          kind: 'note',
          notes: (globalNoteText ?? '').trim(),
          topic: globalNoteTopic ?? '',
          noteDate: globalNoteDate ?? '',
          taggedStaff: globalNoteTaggedStaff ?? [],
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create note:', err)
        alert('Failed to create note. Please try again.')
        return
      }
      setGlobalNoteText?.('')
      setGlobalNoteTopic?.('')
      const today = new Date()
      setGlobalNoteDate?.(today.toISOString().split('T')[0])
      setGlobalNoteTaggedStaff?.([])
      setCreatingGlobalNote?.(false)
      onChange?.()
    } catch (e) {
      console.error('Note creation error:', e)
      alert('Error creating note. Please try again.')
    }
  }

  async function deleteGlobalTask(taskId: number) {
    if (!confirm('Delete this task?')) return
    await fetch(`/api/tasks/${taskId}`, {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' },
    }).catch(() => {})
    load()
    onChange?.()
  }

  async function toggleGlobalTaskCompletion(taskId: number, currentDone: boolean) {
    await fetch(`/api/tasks`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: taskId, done: !currentDone }),
    }).catch(() => {})
    load()
    onChange?.()
  }

  function handleGlobalTaskMouseDown(taskId: number) {
    globalTaskMenuTimeoutRef.current = setTimeout(() => {
      setMenuGlobalTaskId(taskId)
    }, 500)
  }

  function handleGlobalTaskMouseUp() {
    if (globalTaskMenuTimeoutRef.current) {
      clearTimeout(globalTaskMenuTimeoutRef.current)
      globalTaskMenuTimeoutRef.current = null
    }
  }

  function handleGlobalTaskTouchStart(taskId: number) {
    globalTaskMenuTimeoutRef.current = setTimeout(() => {
      setMenuGlobalTaskId(taskId)
    }, 500)
  }

  function handleGlobalTaskTouchEnd() {
    if (globalTaskMenuTimeoutRef.current) {
      clearTimeout(globalTaskMenuTimeoutRef.current)
      globalTaskMenuTimeoutRef.current = null
    }
  }

  function handleGlobalNoteMouseDown(noteId: number) {
    globalNoteMenuTimeoutRef.current = setTimeout(() => {
      setMenuGlobalNoteId(noteId)
    }, 500)
  }

  function handleGlobalNoteMouseUp() {
    if (globalNoteMenuTimeoutRef.current) {
      clearTimeout(globalNoteMenuTimeoutRef.current)
      globalNoteMenuTimeoutRef.current = null
    }
  }

  function handleGlobalNoteTouchStart(noteId: number) {
    globalNoteMenuTimeoutRef.current = setTimeout(() => {
      setMenuGlobalNoteId(noteId)
    }, 500)
  }

  function handleGlobalNoteTouchEnd() {
    if (globalNoteMenuTimeoutRef.current) {
      clearTimeout(globalNoteMenuTimeoutRef.current)
      globalNoteMenuTimeoutRef.current = null
    }
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

      {isItemsLaws && creatingGlobalLaw && (
        <div className="px-1 py-1 bg-blue-50 border-t border-blue-200 flex flex-col gap-0.5 text-[8px]">
          <input autoFocus value={globalLawText ?? ''} onChange={e => setGlobalLawText?.(e.target.value)} placeholder="New law…"
            onKeyDown={e => { if (e.key === 'Enter') addGlobalLaw(); if (e.key === 'Escape') setCreatingGlobalLaw?.(false) }}
            className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-0.5">
            <button onClick={addGlobalLaw} disabled={!globalLawText?.trim()} className="flex-1 text-green-600 hover:text-green-700 disabled:opacity-40 font-bold">Add</button>
            <button onClick={() => setCreatingGlobalLaw?.(false)} className="shrink-0 text-gray-400 hover:text-gray-600 font-bold">×</button>
          </div>
        </div>
      )}

      {laws.length === 0 && (!flags || flags.length === 0) ? (
        <p className={`text-[11px] text-gray-400 text-center py-6 ${isItemsLaws ? '' : ''}`}>No laws yet.</p>
      ) : (
        <div className={`bg-white ${isItemsLaws ? 'divide-y divide-gray-100' : 'border border-gray-200 rounded-lg divide-y divide-gray-50'}`}>
          {laws.map((l, i) => (
            <div key={l.id} className={`flex items-center gap-1 ${isItemsLaws ? 'px-1 py-0.5 bg-gray-50/50' : 'px-1 py-0.5 bg-gray-50/50'}`} onMouseDown={() => handleMouseDown(l.id)} onMouseUp={handleMouseUp} onTouchStart={() => handleTouchStart(l.id)} onTouchEnd={handleTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{i + 1}</span>
              {editingId === l.id ? (
                <>
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(l.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="min-w-0 flex-1 text-[8px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                  <button onClick={() => saveEdit(l.id)} title="Save"
                    className="shrink-0 text-green-600 hover:text-green-700 px-0.5 text-[8px] font-bold">✓</button>
                  <button onClick={() => setEditingId(null)} title="Cancel"
                    className="shrink-0 text-gray-400 hover:text-gray-600 px-0.5 text-[8px] font-bold">×</button>
                </>
              ) : (
                <>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1 flex-wrap leading-none">
                      <p className="text-[9px] text-gray-800">{l.text}</p>
                      {!taskForLaw && !noteForLaw && (
                        <>
                          <button onClick={() => { setTaskForLaw(l.id); fetchTasksForLaw(l.id) }} title="Add task" className="text-blue-500 hover:text-blue-600 font-semibold text-[8px]">✓ Task</button>
                          <button onClick={() => setNoteForLaw(l.id)} title="Add note" className="text-amber-500 hover:text-amber-600 font-semibold text-[8px]">📝 Note</button>
                        </>
                      )}
                    </div>
                    {menuLawId === l.id && (
                      <div className="flex gap-1 text-[8px]">
                        <button onClick={() => startEdit(l)} title="Edit" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                        <button onClick={() => { setReplyingTo(`law-${l.id}`); fetchReplies('law', l.id) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                        <button onClick={() => { remove(l.id); setMenuLawId(null) }} className="text-red-500 hover:text-red-700 font-semibold">×</button>
                      </div>
                    )}
                    {taskForLaw === l.id ? (
                      <div className="flex flex-col gap-0.5 bg-blue-50 p-1 border border-blue-200 leading-none">
                        <input autoFocus value={taskTitle} onChange={e => setTaskTitle(e.target.value)} placeholder="Task…"
                          onKeyDown={e => { if (e.key === 'Enter') addTaskForLaw(); if (e.key === 'Escape') setTaskForLaw(null) }}
                          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                        <select value={taskType} onChange={e => setTaskType(e.target.value)}
                          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                          <option>General</option>
                          <option>App</option>
                        </select>
                        <select value={taskAssignedTo} onChange={e => setTaskAssignedTo(e.target.value)}
                          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                          <option value="">Assign…</option>
                          {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                        </select>
                        <div className="flex gap-0.5">
                          <button onClick={addTaskForLaw} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Create</button>
                          <button onClick={() => setTaskForLaw(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                        </div>
                      </div>
                    ) : noteForLaw === l.id ? (
                      <div className="flex flex-col gap-0.5">
                        <textarea autoFocus value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Note…" rows={1}
                          onKeyDown={e => { if (e.key === 'Escape') setNoteForLaw(null) }}
                          className="flex-1 min-w-0 text-[8px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
                        <div className="flex gap-0.5">
                          <button onClick={addNoteForLaw} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Save</button>
                          <button onClick={() => setNoteForLaw(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {tasksByLawId[l.id]?.length > 0 && (
                          <div className="space-y-0.5 text-[8px]">
                            {tasksByLawId[l.id].map(task => (
                              <div key={task.id} className={`p-0.5 rounded border leading-tight ${task.done ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`} onMouseDown={() => handleTaskMouseDown(task.id)} onMouseUp={handleTaskMouseUp} onTouchStart={() => handleTaskTouchStart(task.id)} onTouchEnd={handleTaskTouchEnd}>
                                {editingTaskId === task.id ? (
                                  <div className="flex flex-col gap-0.5 leading-none">
                                    <input autoFocus value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} placeholder="Task…"
                                      onKeyDown={e => { if (e.key === 'Enter') saveEditTask(l.id); if (e.key === 'Escape') setEditingTaskId(null) }}
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
                                      <button onClick={() => saveEditTask(l.id)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">✓</button>
                                      <button onClick={() => setEditingTaskId(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex flex-col gap-0.5">
                                    <p className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                                    <div className="flex items-center gap-1 flex-wrap text-[7px] text-gray-600">
                                      <span>{task.task_type === 'App task' ? 'App' : 'General'}</span>
                                      <span>•</span>
                                      <span>{formatDate(task.created_at)} by {task.created_by}</span>
                                      {task.assigned_to && (<><span>•</span><span>To: {task.assigned_to}</span></>)}
                                      {task.done && task.completed_at && (<><span>•</span><span>{calculateDuration(task.created_at, task.completed_at)}</span></>)}
                                    </div>
                                    {menuTaskId === task.id && (
                                      <div className="flex gap-1 text-[8px] mt-0.5">
                                        <button onClick={() => { toggleTaskCompletion(task.id, task.done, l.id); setMenuTaskId(null) }} title={task.done ? 'Reopen' : 'Complete'} className="text-green-600 hover:text-green-700 font-semibold">✓</button>
                                        <button onClick={() => { startEditTask(task); setMenuTaskId(null) }} title="Edit task" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                                        <button onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id); setMenuTaskId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                                        <button onClick={() => { deleteTask(task.id, l.id); setMenuTaskId(null) }} title="Delete task" className="text-red-500 hover:text-red-700 font-semibold">×</button>
                                      </div>
                                    )}
                                    {replyingTo === `task-${task.id}` && (
                                      <div className="mt-0.5 bg-gray-50 p-1 rounded border border-gray-200 space-y-0.5">
                                        <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={1}
                                          onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                                          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                                        <div className="flex gap-0.5">
                                          <button onClick={() => addReply('task', task.id)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Post</button>
                                          <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                                        </div>
                                      </div>
                                    )}
                                    {repliesByItem[`task-${task.id}`]?.length > 0 && (
                                      <div className="mt-0.5 space-y-0.5 text-[7px] border-l border-gray-200 pl-1">
                                        {repliesByItem[`task-${task.id}`].map(reply => (
                                          <div key={reply.id} className="bg-gray-50 p-0.5 rounded">
                                            <div className="flex items-center justify-between gap-1">
                                              <span className="font-semibold text-gray-700">{reply.created_by}</span>
                                              <button onClick={() => deleteReply(reply.id, 'task', task.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                            </div>
                                            <p className="text-gray-600">{reply.reply_text}</p>
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
          {flags && flags.filter(f => !hideZeroFlags || f.count > 0).map((f, i) => (
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
                          <div key={task.id} className={`p-0.5 rounded border leading-tight ${task.done ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`} onMouseDown={() => handleTaskMouseDown(task.id)} onMouseUp={handleTaskMouseUp} onTouchStart={() => handleTaskTouchStart(task.id)} onTouchEnd={handleTaskTouchEnd}>
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
                              <div className="flex flex-col gap-0.5">
                                <p className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                                <div className="flex items-center gap-1 flex-wrap text-[7px] text-gray-600">
                                  <span>{task.task_type === 'App task' ? 'App' : 'General'}</span>
                                  <span>•</span>
                                  <span>{formatDate(task.created_at)} by {task.created_by}</span>
                                  {task.assigned_to && (<><span>•</span><span>To: {task.assigned_to}</span></>)}
                                  {task.done && task.completed_at && (<><span>•</span><span>{calculateDuration(task.created_at, task.completed_at)}</span></>)}
                                </div>
                                {menuTaskId === task.id && (
                                  <div className="flex gap-1 text-[8px] mt-0.5">
                                    <button onClick={() => { toggleTaskCompletion(task.id, task.done, undefined, f.key); setMenuTaskId(null) }} title={task.done ? 'Reopen' : 'Complete'} className="text-green-600 hover:text-green-700 font-semibold">✓</button>
                                    <button onClick={() => { startEditTask(task); setMenuTaskId(null) }} title="Edit task" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                                    <button onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id); setMenuTaskId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                                    <button onClick={() => { deleteTask(task.id, undefined, f.key); setMenuTaskId(null) }} title="Delete task" className="text-red-500 hover:text-red-700 font-semibold">×</button>
                                  </div>
                                )}
                                {replyingTo === `task-${task.id}` && (
                                  <div className="mt-0.5 bg-gray-50 p-1 rounded border border-gray-200 space-y-0.5">
                                    <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={1}
                                      onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                                    <div className="flex gap-0.5">
                                      <button onClick={() => addReply('task', task.id)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Post</button>
                                      <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                                    </div>
                                  </div>
                                )}
                                {repliesByItem[`task-${task.id}`]?.length > 0 && (
                                  <div className="mt-0.5 space-y-0.5 text-[7px] border-l border-gray-200 pl-1">
                                    {repliesByItem[`task-${task.id}`].map(reply => (
                                      <div key={reply.id} className="bg-gray-50 p-0.5 rounded">
                                        <div className="flex items-center justify-between gap-1">
                                          <span className="font-semibold text-gray-700">{reply.created_by}</span>
                                          <button onClick={() => deleteReply(reply.id, 'task', task.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                                        </div>
                                        <p className="text-gray-600">{reply.reply_text}</p>
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
                  </>
                )}
              </div>
            </div>
          ))}
          {globalTasks.map((task, i) => (
            <div key={`task-${task.id}`} className="px-1 py-0.5 bg-green-50/50 flex items-center gap-1" onMouseDown={() => handleGlobalTaskMouseDown(task.id)} onMouseUp={handleGlobalTaskMouseUp} onTouchStart={() => handleGlobalTaskTouchStart(task.id)} onTouchEnd={handleGlobalTaskTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{laws.length + (flags?.length || 0) + i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-gray-800">✓ {task.title}</p>
                {task.assigned_to && (<p className="text-[8px] text-gray-500">To: {task.assigned_to}</p>)}
                {menuGlobalTaskId === task.id && (
                  <div className="flex gap-1 text-[8px] mt-0.5">
                    <button onClick={() => { toggleGlobalTaskCompletion(task.id, task.done); setMenuGlobalTaskId(null) }} title={task.done ? 'Reopen' : 'Complete'} className="text-green-600 hover:text-green-700 font-semibold">✓</button>
                    <button onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id); setMenuGlobalTaskId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                    <button onClick={() => { deleteGlobalTask(task.id); setMenuGlobalTaskId(null) }} title="Delete task" className="text-red-500 hover:text-red-700 font-semibold">×</button>
                  </div>
                )}
                {replyingTo === `task-${task.id}` && (
                  <div className="mt-0.5 bg-gray-50 p-1 rounded border border-gray-200 space-y-0.5">
                    <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={1}
                      onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                    <div className="flex gap-0.5">
                      <button onClick={() => addReply('task', task.id)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Post</button>
                      <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                    </div>
                  </div>
                )}
                {repliesByItem[`task-${task.id}`]?.length > 0 && (
                  <div className="mt-0.5 space-y-0.5 text-[7px] border-l border-gray-200 pl-1">
                    {repliesByItem[`task-${task.id}`].map(reply => (
                      <div key={reply.id} className="bg-gray-50 p-0.5 rounded">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-gray-700">{reply.created_by}</span>
                          <button onClick={() => deleteReply(reply.id, 'task', task.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                        </div>
                        <p className="text-gray-600">{reply.reply_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {globalNotes.map((note, i) => (
            <div key={`global-note-${note.id || i}`} className="px-1 py-0.5 bg-yellow-50/50 flex items-center gap-1" onMouseDown={() => handleGlobalNoteMouseDown(note.id || 0)} onMouseUp={handleGlobalNoteMouseUp} onTouchStart={() => handleGlobalNoteTouchStart(note.id || 0)} onTouchEnd={handleGlobalNoteTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{laws.length + (flags?.length || 0) + globalTasks.length + i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-gray-800">📝 {note.topic || 'Note'}</p>
                {note.notes && (<p className="text-[8px] text-gray-600 line-clamp-1">{note.notes}</p>)}
                {menuGlobalNoteId === (note.id || 0) && (
                  <div className="flex gap-1 text-[8px] mt-0.5">
                    <button onClick={() => { setReplyingTo(`note-${note.id}`); fetchReplies('note', note.id); setMenuGlobalNoteId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                  </div>
                )}
                {replyingTo === `note-${note.id}` && (
                  <div className="mt-0.5 bg-gray-50 p-1 rounded border border-gray-200 space-y-0.5">
                    <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={1}
                      onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full" />
                    <div className="flex gap-0.5">
                      <button onClick={() => addReply('note', note.id)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Post</button>
                      <button onClick={() => { setReplyingTo(null); setReplyText('') }} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                    </div>
                  </div>
                )}
                {repliesByItem[`note-${note.id}`]?.length > 0 && (
                  <div className="mt-0.5 space-y-0.5 text-[7px] border-l border-gray-200 pl-1">
                    {repliesByItem[`note-${note.id}`].map(reply => (
                      <div key={reply.id} className="bg-gray-50 p-0.5 rounded">
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-semibold text-gray-700">{reply.created_by}</span>
                          <button onClick={() => deleteReply(reply.id, 'note', note.id)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                        </div>
                        <p className="text-gray-600">{reply.reply_text}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isItemsLaws && creatingGlobalTask && (
            <div className="px-1 py-1 bg-blue-50 border-t border-blue-200 flex flex-col gap-0.5 text-[8px]">
              <input autoFocus value={globalTaskTitle ?? ''} onChange={e => setGlobalTaskTitle?.(e.target.value)} placeholder="Task…"
                onKeyDown={e => { if (e.key === 'Enter') addGlobalTask(); if (e.key === 'Escape') setCreatingGlobalTask?.(false) }}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
              <select value={globalTaskType ?? 'General task'} onChange={e => setGlobalTaskType?.(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                <option>General task</option>
                <option>App task</option>
              </select>
              <select value={globalTaskAssignedTo ?? ''} onChange={e => setGlobalTaskAssignedTo?.(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">Assign to…</option>
                {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
              </select>
              <div className="flex gap-0.5">
                <button onClick={addGlobalTask} className="flex-1 text-green-600 hover:text-green-700 font-bold">Create</button>
                <button onClick={() => setCreatingGlobalTask?.(false)} className="shrink-0 text-gray-400 hover:text-gray-600 font-bold">×</button>
              </div>
            </div>
          )}
          {isItemsLaws && creatingGlobalNote && (
            <div className="px-1 py-1 bg-gray-50 border-t border-gray-200 flex flex-col gap-0.5 text-[8px]">
              <input autoFocus value={globalNoteTopic ?? ''} onChange={e => setGlobalNoteTopic?.(e.target.value)} placeholder="Topic…"
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
              <div className="flex gap-0.5">
                <input type="date" value={globalNoteDate ?? ''} onChange={e => setGlobalNoteDate?.(e.target.value)}
                  className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                <input type="text" value={globalNoteTaggedStaff?.join(', ') ?? ''} onChange={e => setGlobalNoteTaggedStaff?.(e.target.value.split(',').map(s => s.trim()).filter(s => s))} placeholder="Tag staff (@name, @name)"
                  className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
              </div>
              <textarea value={globalNoteText ?? ''} onChange={e => setGlobalNoteText?.(e.target.value)} placeholder="Note content… (use @ to tag staff)" rows={2}
                onKeyDown={e => { if (e.key === 'Escape') setCreatingGlobalNote?.(false) }}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
              <div className="flex gap-0.5">
                <button onClick={addGlobalNote} className="flex-1 text-green-600 hover:text-green-700 font-bold">Save</button>
                <button onClick={() => setCreatingGlobalNote?.(false)} className="shrink-0 text-gray-400 hover:text-gray-600 font-bold">×</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
