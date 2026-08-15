'use client'
import { useState, useEffect, useRef } from 'react'
import { ASSIGNABLE_STAFF } from './violationAssignments'
import type { LawFilterKey } from './useLawsPanel'

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

type Note = { notes?: string; topic?: string; noteDate?: string }
type Reply = { id: number; created_by: string; reply_text: string; created_at: string }

export type FlagLaw = {
  key: string
  label: string
  description?: string
  count: number
  active?: boolean
  onViewClick?: () => void
}

// Which of the three "global" (not tied to one law/flag) creation forms is
// open, if any -- lifted only because the trigger buttons for it live in
// the caller's own header bar (SalesTab's green bar, item/page.tsx's Items
// header), physically separate from where this list renders below them.
// Every other piece of that form's state (the actual text typed into it)
// has no reason to live outside this component and stays local.
export type LawFormKind = 'law' | 'task' | null

// Long-press (mobile) / mousedown-hold (desktop) to reveal a row's action
// menu -- one shared implementation instead of a separate mousedown/
// mouseup/touchstart/touchend quadruple per menu (law rows, task rows,
// global task rows, global note rows all used to redeclare the same four
// functions around their own timeout ref).
function useLongPress(onTrigger: (id: number | string) => void, delay = 500) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const start = (id: number | string) => {
    timeoutRef.current = setTimeout(() => onTrigger(id), delay)
  }
  const cancel = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
  }
  return { onMouseDown: start, onMouseUp: cancel, onTouchStart: start, onTouchEnd: cancel }
}

// The fixed rules for this page, as a real list -- each one its own row
// (page_laws table) instead of one freeform textarea, so PageToolIcons can
// badge the page with how many laws it actually has. Notes (PageLawsNote)
// stays a single textarea -- only Law changed shape. Optional flags prop
// appends flag laws as continuation items after regular editable laws.
export default function PageLawsList({
  scopeKey, onChange, flags, isItemsLaws = false,
  openForm, setOpenForm,
  hideZeroFlags, setHideZeroFlags,
  activeFilters,
  customViewNames = {},
  onSaveViewName,
}: {
  scopeKey: string
  onChange?: () => void
  flags?: FlagLaw[]
  isItemsLaws?: boolean
  openForm?: LawFormKind
  setOpenForm?: (v: LawFormKind) => void
  hideZeroFlags?: boolean
  setHideZeroFlags?: (v: boolean | ((prev: boolean) => boolean)) => void
  activeFilters?: Set<LawFilterKey>
  customViewNames?: Record<string, string>
  onSaveViewName?: (viewKey: string, customLabel: string) => void
}) {
  const [laws, setLaws] = useState<Law[]>([])
  const [globalTasks, setGlobalTasks] = useState<Task[]>([])
  const [globalNotes, setGlobalNotes] = useState<(Note & { id?: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editText, setEditText] = useState('')

  // Per-law and per-flag "add a task/note for this one" inline forms.
  const [taskForLaw, setTaskForLaw] = useState<number | null>(null)
  const [taskTitle, setTaskTitle] = useState('')
  const [taskType, setTaskType] = useState('General +')
  const [taskAssignedTo, setTaskAssignedTo] = useState('')
  const [noteForLaw, setNoteForLaw] = useState<number | null>(null)
  const [noteText, setNoteText] = useState('')
  const [taskForFlag, setTaskForFlag] = useState<string | null>(null)
  const [taskTitleForFlag, setTaskTitleForFlag] = useState('')
  const [taskTypeForFlag, setTaskTypeForFlag] = useState('General +')
  const [taskAssignedToFlag, setTaskAssignedToFlag] = useState('')
  const [noteForFlag, setNoteForFlag] = useState<string | null>(null)
  const [noteTextForFlag, setNoteTextForFlag] = useState('')

  // The "global" (Items-scope header bar) add forms -- open/closed comes
  // from the caller (openForm/setOpenForm), everything typed into them is
  // local.
  const [globalLawText, setGlobalLawText] = useState('')
  const [globalTaskTitle, setGlobalTaskTitle] = useState('')
  const [globalTaskType, setGlobalTaskType] = useState('General +')
  const [globalTaskAssignedTo, setGlobalTaskAssignedTo] = useState('')
  const [globalNoteTopic, setGlobalNoteTopic] = useState('')
  const [globalNoteText, setGlobalNoteText] = useState('')
  const [globalNoteDate, setGlobalNoteDate] = useState(() => new Date().toISOString().split('T')[0])
  const [globalNoteTaggedStaff, setGlobalNoteTaggedStaff] = useState<string[]>([])
  const [customLawOrder, setCustomLawOrder] = useState<string[]>([])
  const [customFlagNames, setCustomFlagNames] = useState<Record<string, string>>({})
  const [expandedFlagDesc, setExpandedFlagDesc] = useState<string | null>(null)
  const [editingFlagKey, setEditingFlagKey] = useState<string | null>(null)
  const [editFlagLabel, setEditFlagLabel] = useState('')

  const [menuLawId, setMenuLawId] = useState<number | null>(null)
  const [menuFlagKey, setMenuFlagKey] = useState<string | null>(null)
  const [menuTaskId, setMenuTaskId] = useState<number | null>(null)
  const [menuGlobalTaskId, setMenuGlobalTaskId] = useState<number | null>(null)
  const [menuGlobalNoteId, setMenuGlobalNoteId] = useState<number | null>(null)
  const lawPress = useLongPress(id => setMenuLawId(id as number))
  const flagPress = useLongPress(id => setMenuFlagKey(id as string))
  const taskPress = useLongPress(id => setMenuTaskId(id as number))
  const globalTaskPress = useLongPress(id => setMenuGlobalTaskId(id as number))
  const globalNotePress = useLongPress(id => setMenuGlobalNoteId(id as number))

  const [taskForLawLoaded, setTaskForLawLoaded] = useState<Record<number, Task[]>>({})
  const [tasksByFlagKey, setTasksByFlagKey] = useState<Record<string, Task[]>>({})
  const [notesByLawId, setNotesByLawId] = useState<Record<number, Note>>({})
  const [notesByFlagKey, setNotesByFlagKey] = useState<Record<string, Note>>({})
  const [repliesByItem, setRepliesByItem] = useState<Record<string, Reply[]>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')
  const [editingTaskId, setEditingTaskId] = useState<number | null>(null)
  const [editTaskTitle, setEditTaskTitle] = useState('')
  const [editTaskType, setEditTaskType] = useState('General +')
  const [editTaskAssignedTo, setEditTaskAssignedTo] = useState('')

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
      setTaskForLawLoaded(prev => ({ ...prev, [lawId]: Array.isArray(tasks) ? tasks : [] }))
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

  async function fetchNoteForLaw(lawId: number) {
    try {
      const res = await fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&lawId=${lawId}&kind=note`)
      const note = await res.json()
      setNotesByLawId(prev => ({ ...prev, [lawId]: note }))
    } catch (e) {
      console.error('fetch note error:', e)
    }
  }

  async function fetchNoteForFlag(flagKey: string) {
    try {
      const res = await fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&flagKey=${encodeURIComponent(flagKey)}&kind=note`)
      const note = await res.json()
      setNotesByFlagKey(prev => ({ ...prev, [flagKey]: note }))
    } catch (e) {
      console.error('fetch note error:', e)
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
    setEditTaskType(task.task_type || 'General +')
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
    setEditTaskType('General +')
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
    // Load custom law order
    fetch(`/api/law-order?scopeKey=${encodeURIComponent(scopeKey)}`)
      .then(r => r.ok ? r.json() : { order: [] })
      .then(d => setCustomLawOrder(Array.isArray(d.order) ? d.order : []))
      .catch(() => {})
    // Load custom flag names
    fetch('/api/rename-flag')
      .then(r => r.ok ? r.json() : {})
      .then(d => setCustomFlagNames(d))
      .catch(() => {})
    // Load global tasks/notes for this scope
    if (isItemsLaws) {
      fetch(`/api/tasks?submenu=${encodeURIComponent(scopeKey)}`)
        .then(r => r.ok ? r.json() : [])
        .then(d => setGlobalTasks(Array.isArray(d) ? d.filter((t: Task) => !t.done) : []))
        .catch(() => {})
      fetch(`/api/page-notes?scopeKey=${encodeURIComponent(scopeKey)}&kind=note`)
        .then(r => r.ok ? r.json() : null)
        .then(d => setGlobalNotes(d && (d.notes || d.topic) ? [d] : []))
        .catch(() => {})
    }
  }

  async function saveLawOrder(newOrder: string[]) {
    setCustomLawOrder(newOrder)
    await fetch('/api/law-order', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scopeKey, order: newOrder }),
    }).catch(() => {})
  }

  const VIEW_KEYS = ['all_expenses', 'by_account', 'by_vendor', 'show_properties', 'show_non_properties', 'prop_available', 'prop_not_available']

  async function saveCustomFlagName(flagKey: string, customLabel: string) {
    setCustomFlagNames(prev => ({ ...prev, [flagKey]: customLabel }))
    if (VIEW_KEYS.includes(flagKey)) {
      onSaveViewName?.(flagKey, customLabel)
    } else {
      await fetch('/api/rename-flag', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flagKey, customLabel }),
      }).catch(() => {})
    }
  }

  function startEditFlag(flag: FlagLaw) {
    setEditingFlagKey(flag.key)
    const isView = VIEW_KEYS.includes(flag.key)
    setEditFlagLabel((isView ? customViewNames[flag.key] : customFlagNames[flag.key]) || flag.label)
  }

  function moveLawInOrder(key: string, direction: 'up' | 'down') {
    const allKeys = [...customLawOrder]
    const idx = allKeys.indexOf(key)
    if (idx === -1) {
      // Not in custom order yet, initialize it
      const allLawKeys = laws.map(l => `law-${l.id}`)
      const allFlagKeys = flags?.map(f => f.key) ?? []
      const allKey = [...allLawKeys, ...allFlagKeys]
      const newIdx = allKey.indexOf(key)
      if (newIdx === -1) return
      if (direction === 'up' && newIdx === 0) return
      if (direction === 'down' && newIdx === allKey.length - 1) return
      const swapIdx = direction === 'up' ? newIdx - 1 : newIdx + 1
      ;[allKey[newIdx], allKey[swapIdx]] = [allKey[swapIdx], allKey[newIdx]]
      saveLawOrder(allKey)
    } else {
      if (direction === 'up' && idx === 0) return
      if (direction === 'down' && idx === allKeys.length - 1) return
      const swapIdx = direction === 'up' ? idx - 1 : idx + 1
      ;[allKeys[idx], allKeys[swapIdx]] = [allKeys[swapIdx], allKeys[idx]]
      saveLawOrder(allKeys)
    }
  }

  useEffect(() => { load() }, [scopeKey])

  useEffect(() => {
    laws.forEach(law => {
      if (!taskForLawLoaded[law.id]) fetchTasksForLaw(law.id)
      if (!notesByLawId[law.id]) fetchNoteForLaw(law.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [laws])

  useEffect(() => {
    if (flags) {
      flags.forEach(flag => {
        if (!tasksByFlagKey[flag.key]) fetchTasksForFlag(flag.key)
        if (!notesByFlagKey[flag.key]) fetchNoteForFlag(flag.key)
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    if (!globalLawText.trim()) return
    try {
      const res = await fetch('/api/page-laws', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeKey, text: globalLawText.trim() }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create law:', err)
        alert('Failed to create law. Please try again.')
        return
      }
      setGlobalLawText('')
      setOpenForm?.(null)
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
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitle.trim(), submenu: scopeKey, law_id: lawId,
          task_type: taskType, assigned_to: taskAssignedTo || null,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        alert(`Failed to create task: ${err}`)
        return
      }
      setTaskTitle('')
      setTaskType('General +')
      setTaskAssignedTo('')
      setTaskForLaw(null)
      setTimeout(() => fetchTasksForLaw(lawId), 200)
      onChange?.()
    } catch (e) {
      console.error('Task creation error:', e)
      alert(`Error creating task: ${String(e)}`)
    }
  }

  async function addNoteForLaw() {
    if (noteForLaw === null) return
    const lawId = noteForLaw
    try {
      const res = await fetch('/api/page-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeKey, kind: 'note', notes: noteText.trim(), law_id: lawId }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create note:', err)
        alert(`Failed to save note: ${err}`)
        return
      }
      setNoteText('')
      setNoteForLaw(null)
      setTimeout(() => fetchNoteForLaw(lawId), 200)
      onChange?.()
    } catch (e) {
      console.error('Note creation error:', e)
      alert(`Error saving note: ${String(e)}`)
    }
  }

  async function addTaskForFlag() {
    if (!taskTitleForFlag.trim() || taskForFlag === null) return
    const flagKey = taskForFlag
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: taskTitleForFlag.trim(), submenu: scopeKey, flag_key: flagKey,
          task_type: taskTypeForFlag, assigned_to: taskAssignedToFlag || null,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        alert(`Failed to create task: ${err}`)
        return
      }
      setTaskTitleForFlag('')
      setTaskTypeForFlag('General +')
      setTaskAssignedToFlag('')
      setTaskForFlag(null)
      setTimeout(() => fetchTasksForFlag(flagKey), 200)
      onChange?.()
    } catch (e) {
      console.error('Task creation error:', e)
      alert(`Error creating task: ${String(e)}`)
    }
  }

  async function addNoteForFlag() {
    if (noteForFlag === null) return
    const flagKey = noteForFlag
    try {
      const res = await fetch('/api/page-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopeKey, kind: 'note', notes: noteTextForFlag.trim(), flag_key: flagKey }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create note:', err)
        alert(`Failed to save note: ${err}`)
        return
      }
      setNoteTextForFlag('')
      setNoteForFlag(null)
      setTimeout(() => fetchNoteForFlag(flagKey), 200)
      onChange?.()
    } catch (e) {
      console.error('Note creation error:', e)
      alert(`Error saving note: ${String(e)}`)
    }
  }

  async function addGlobalTask() {
    if (!globalTaskTitle.trim()) return
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: globalTaskTitle.trim(), submenu: scopeKey,
          task_type: globalTaskType, assigned_to: globalTaskAssignedTo || null,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create task:', err)
        alert('Failed to create task. Please try again.')
        return
      }
      setGlobalTaskTitle('')
      setGlobalTaskType('General +')
      setGlobalTaskAssignedTo('')
      setOpenForm?.(null)
      load()
      onChange?.()
    } catch (e) {
      console.error('Task creation error:', e)
      alert('Error creating task. Please try again.')
    }
  }

  async function addGlobalNote() {
    if (!globalNoteText.trim()) return
    try {
      const res = await fetch('/api/page-notes', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scopeKey, kind: 'note', notes: globalNoteText.trim(),
          topic: globalNoteTopic, noteDate: globalNoteDate, taggedStaff: globalNoteTaggedStaff,
        }),
      })
      if (!res.ok) {
        const err = await res.text()
        console.error('Failed to create note:', err)
        alert(`Failed to create note: ${err}`)
        return
      }
      setGlobalNoteText('')
      setGlobalNoteTopic('')
      setGlobalNoteDate(new Date().toISOString().split('T')[0])
      setGlobalNoteTaggedStaff([])
      setOpenForm?.(null)
      // Wait a moment for the database to persist, then reload
      setTimeout(() => load(), 200)
      onChange?.()
    } catch (e) {
      console.error('Note creation error:', e)
      alert(`Error creating note: ${String(e)}`)
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

  // Reply thread shared by law rows, task rows (nested under a law/flag),
  // and the flat global task/note rows -- law rows use the larger 'lg'
  // sizing, everything nested under a task/note uses the compact 'sm' one.
  function renderReplyThread(itemKey: string, itemType: string, itemId: number | string, size: 'sm' | 'lg' = 'sm') {
    const lg = size === 'lg'
    return (
      <>
        {replyingTo === itemKey && (
          <div className={lg ? 'mt-2 bg-gray-50 p-2 rounded border border-gray-200 space-y-1.5' : 'mt-0.5 bg-gray-50 p-1 rounded border border-gray-200 space-y-0.5'}>
            <textarea autoFocus value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Reply…" rows={lg ? 2 : 1}
              onKeyDown={e => { if (e.key === 'Escape') { setReplyingTo(null); setReplyText('') } }}
              className={`flex-1 min-w-0 ${lg ? 'text-[10px] rounded' : 'text-[8px]'} bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none w-full`} />
            <div className={lg ? 'flex gap-1' : 'flex gap-0.5'}>
              <button type="button" onClick={() => addReply(itemType, itemId)} className={`flex-1 text-green-600 hover:text-green-700 ${lg ? 'text-xs' : 'text-[8px]'} font-bold`}>Post</button>
              <button type="button" onClick={() => { setReplyingTo(null); setReplyText('') }} className={`shrink-0 text-gray-400 hover:text-gray-600 ${lg ? 'text-xs' : 'text-[8px]'} font-bold`}>×</button>
            </div>
          </div>
        )}
        {repliesByItem[itemKey]?.length > 0 && (
          <div className={lg ? 'mt-2 space-y-1 text-[9px] border-l-2 border-gray-200 pl-2' : 'mt-0.5 space-y-0.5 text-[7px] border-l border-gray-200 pl-1'}>
            {repliesByItem[itemKey].map(reply => (
              <div key={reply.id} className={lg ? 'bg-gray-50 p-1.5 rounded' : 'bg-gray-50 p-0.5 rounded'}>
                <div className={lg ? 'flex items-start justify-between gap-2' : 'flex items-center justify-between gap-1'}>
                  <p className="font-semibold text-gray-700">{reply.created_by}</p>
                  <button type="button" onClick={() => deleteReply(reply.id, itemType, itemId)} className="text-red-500 hover:text-red-700 font-bold">×</button>
                </div>
                <p className="text-gray-600 mt-0.5">{reply.reply_text}</p>
                {lg && <p className="text-gray-400 mt-0.5">{formatDate(reply.created_at)}</p>}
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  // "Add a task for this law/flag" inline form -- identical for both, only
  // which create-handler and cancel-handler it's wired to differs.
  function renderAddTaskForm(title: string, setTitle: (v: string) => void, type: string, setType: (v: string) => void,
    assignedTo: string, setAssignedTo: (v: string) => void, onCreate: () => void, onCancel: () => void) {
    return (
      <div className="flex flex-col gap-0.5 bg-blue-50 p-1 border border-blue-200 leading-none">
        <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="Task…"
          onKeyDown={e => { if (e.key === 'Enter') onCreate(); if (e.key === 'Escape') onCancel() }}
          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
        <select value={type} onChange={e => setType(e.target.value)}
          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
          <option>General +</option>
          <option>App +</option>
          <option>Note</option>
        </select>
        <select value={assignedTo} onChange={e => setAssignedTo(e.target.value)}
          className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
          <option value="">Assign…</option>
          {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
        </select>
        <div className="flex gap-0.5">
          <button type="button" onClick={onCreate} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Create</button>
          <button type="button" onClick={onCancel} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
        </div>
      </div>
    )
  }

  // "Add a note for this law/flag" inline form -- same story.
  function renderAddNoteForm(value: string, setValue: (v: string) => void, onSave: () => void, onCancel: () => void) {
    return (
      <div className="flex flex-col gap-0.5">
        <textarea autoFocus value={value} onChange={e => setValue(e.target.value)} placeholder="Note…" rows={1}
          onKeyDown={e => { if (e.key === 'Escape') onCancel() }}
          className="flex-1 min-w-0 text-[8px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400 resize-none" />
        <div className="flex gap-1">
          <button type="button" onClick={onSave} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">Save</button>
          <button type="button" onClick={onCancel} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
        </div>
      </div>
    )
  }

  // The task list + note attached to one law or one flag -- was duplicated
  // near-verbatim once for laws (keyed by numeric law_id) and once for
  // flags (keyed by string flag_key); both just needed a task list, a
  // note, and which of (lawId, flagKey) to pass back through to the
  // shared toggle/edit/delete handlers above.
  function renderAttachedItems(tasks: Task[] | undefined, lawId?: number, flagKey?: string) {
    return (
      <>
        {tasks && tasks.length > 0 && (
          <div className="space-y-0.5 text-[8px]">
            {tasks.map(task => (
              <div key={task.id} className={`p-0.5 rounded border leading-tight ${task.done ? 'bg-gray-50 border-gray-200' : 'bg-blue-50 border-blue-200'}`}
                onMouseDown={() => taskPress.onMouseDown(task.id)} onMouseUp={taskPress.onMouseUp}
                onTouchStart={() => taskPress.onTouchStart(task.id)} onTouchEnd={taskPress.onTouchEnd}>
                {editingTaskId === task.id ? (
                  <div className="flex flex-col gap-0.5 leading-none">
                    <input autoFocus value={editTaskTitle} onChange={e => setEditTaskTitle(e.target.value)} placeholder="Task…"
                      onKeyDown={e => { if (e.key === 'Enter') saveEditTask(lawId, flagKey); if (e.key === 'Escape') setEditingTaskId(null) }}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                    <select value={editTaskType} onChange={e => setEditTaskType(e.target.value)}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                      <option>General +</option>
                      <option>App +</option>
                      <option>Note</option>
                    </select>
                    <select value={editTaskAssignedTo} onChange={e => setEditTaskAssignedTo(e.target.value)}
                      className="flex-1 min-w-0 text-[8px] bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                      <option value="">Assign…</option>
                      {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
                    </select>
                    <div className="flex gap-0.5">
                      <button type="button" onClick={() => saveEditTask(lawId, flagKey)} className="flex-1 text-green-600 hover:text-green-700 text-[8px] font-bold">✓</button>
                      <button type="button" onClick={() => setEditingTaskId(null)} className="shrink-0 text-gray-400 hover:text-gray-600 text-[8px] font-bold">×</button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-0.5">
                    <p className={`font-semibold ${task.done ? 'line-through text-gray-500' : 'text-gray-800'}`}>{task.title}</p>
                    <div className="flex items-center gap-1 flex-wrap text-[7px] text-gray-600">
                      <span>{task.task_type === 'App +' ? 'App' : task.task_type === 'Note' ? 'Note' : 'General'}</span>
                      <span>•</span>
                      <span>{formatDate(task.created_at)} by {task.created_by}</span>
                      {task.assigned_to && (<><span>•</span><span>To: {task.assigned_to}</span></>)}
                      {task.done && task.completed_at && (<><span>•</span><span>{calculateDuration(task.created_at, task.completed_at)}</span></>)}
                    </div>
                    {menuTaskId === task.id && (
                      <div className="flex gap-1 text-[8px] mt-0.5">
                        <button type="button" onClick={() => { toggleTaskCompletion(task.id, task.done, lawId, flagKey); setMenuTaskId(null) }} title={task.done ? 'Reopen' : 'Complete'} className="text-green-600 hover:text-green-700 font-semibold">✓</button>
                        <button type="button" onClick={() => { startEditTask(task); setMenuTaskId(null) }} title="Edit task" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                        <button type="button" onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id); setMenuTaskId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                        <button type="button" onClick={() => { deleteTask(task.id, lawId, flagKey); setMenuTaskId(null) }} title="Delete task" className="text-red-500 hover:text-red-700 font-semibold">×</button>
                      </div>
                    )}
                    {renderReplyThread(`task-${task.id}`, 'task', task.id, 'sm')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </>
    )
  }

  if (loading) return <div className="py-6 text-center text-gray-400 text-xs">Loading…</div>

  // L/G/T/N row-category filters -- empty set (the default) shows
  // everything; otherwise only the checked categories show. Group
  // shortcut flags (key prefix `group_`, see item/page.tsx) are their own
  // category (G) separate from real laws/violation flags (L), since
  // they're navigation shortcuts, not laws or violations.
  const anyFilterActive = !!activeFilters && activeFilters.size > 0
  const showLawsFlags = !anyFilterActive || activeFilters!.has('L')
  const showGroupFlags = !anyFilterActive || activeFilters!.has('G')
  const showTasksSection = !anyFilterActive || activeFilters!.has('T')
  const showNotesSection = !anyFilterActive || activeFilters!.has('N')
  const visibleLaws = showLawsFlags ? laws : []
  const visibleFlags = (flags ?? []).filter(f => f.key.startsWith('group_') ? showGroupFlags : showLawsFlags)
  const visibleGlobalTasks = showTasksSection ? globalTasks : []

  // Apply custom law/flag order
  const orderedLaws = customLawOrder.length > 0 ? visibleLaws.sort((a, b) => {
    const aIdx = customLawOrder.indexOf(`law-${a.id}`)
    const bIdx = customLawOrder.indexOf(`law-${b.id}`)
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  }) : visibleLaws

  const orderedFlags = customLawOrder.length > 0 ? visibleFlags.sort((a, b) => {
    const aIdx = customLawOrder.indexOf(a.key)
    const bIdx = customLawOrder.indexOf(b.key)
    if (aIdx === -1 && bIdx === -1) return 0
    if (aIdx === -1) return 1
    if (bIdx === -1) return -1
    return aIdx - bIdx
  }) : visibleFlags

  return (
    <div className={isItemsLaws ? '' : 'space-y-2'}>
      {!isItemsLaws && (
        <>
          <div className="px-2 py-1.5 bg-gray-50 border-b border-gray-200">
            <p className="text-[10px] text-gray-500 font-semibold">Page Rules</p>
            <p className="text-[9px] text-gray-400 mt-0.5">
              Fixed rules for this page -- rarely change, separate from the main Company Laws page.
            </p>
          </div>

          <form onSubmit={addLaw} className="px-2 py-1.5 flex items-center gap-1.5 bg-white border-b border-gray-200">
            <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a law…"
              className="flex-1 min-w-0 text-xs bg-gray-100 border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-blue-400" />
            <button type="submit" disabled={saving || !text.trim()}
              className="shrink-0 text-xs font-semibold px-3 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
              {saving ? '…' : 'Add'}
            </button>
          </form>
        </>
      )}

      {isItemsLaws && openForm === 'law' && (
        <div className="px-1 py-1 bg-blue-50 border-t border-blue-200 flex flex-col gap-0.5 text-[8px]">
          <input autoFocus value={globalLawText} onChange={e => setGlobalLawText(e.target.value)} placeholder="New law…"
            onKeyDown={e => { if (e.key === 'Enter') addGlobalLaw(); if (e.key === 'Escape') setOpenForm?.(null) }}
            className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
          <div className="flex gap-0.5">
            <button type="button" onClick={addGlobalLaw} disabled={!globalLawText.trim()} className="flex-1 text-green-600 hover:text-green-700 disabled:opacity-40 font-bold">Add</button>
            <button type="button" onClick={() => setOpenForm?.(null)} className="shrink-0 text-gray-400 hover:text-gray-600 font-bold">×</button>
          </div>
        </div>
      )}

      {visibleLaws.length === 0 && visibleFlags.length === 0 && visibleGlobalTasks.length === 0 ? (
        <div className={`${isItemsLaws ? 'py-6' : 'px-2 py-4 bg-white border-b border-gray-200'} text-center`}>
          <p className="text-[11px] text-gray-400">{anyFilterActive ? 'Nothing matches this filter.' : 'No laws yet.'}</p>
        </div>
      ) : (
        <div className={`bg-white ${isItemsLaws ? 'divide-y divide-gray-100' : 'border border-gray-200 rounded-lg divide-y divide-gray-50'}`}>
          {orderedLaws.map((l, i) => (
            <div key={l.id} className="flex items-start gap-1 px-1 py-0.5 bg-gray-50/50"
              onMouseDown={() => lawPress.onMouseDown(l.id)} onMouseUp={lawPress.onMouseUp}
              onTouchStart={() => lawPress.onTouchStart(l.id)} onTouchEnd={lawPress.onTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{i + 1}</span>
              {editingId === l.id ? (
                <>
                  <input autoFocus value={editText} onChange={e => setEditText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') saveEdit(l.id)
                      if (e.key === 'Escape') setEditingId(null)
                    }}
                    className="min-w-0 flex-1 text-[8px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                  <button type="button" onClick={() => saveEdit(l.id)} title="Save"
                    className="shrink-0 text-green-600 hover:text-green-700 px-0.5 text-[8px] font-bold">✓</button>
                  <button type="button" onClick={() => setEditingId(null)} title="Cancel"
                    className="shrink-0 text-gray-400 hover:text-gray-600 px-0.5 text-[8px] font-bold">×</button>
                </>
              ) : (
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1 flex-wrap leading-none">
                    <p className="text-[9px] text-gray-800">{l.text}</p>
                    {taskForLaw !== l.id && noteForLaw !== l.id && (
                      <>
                        <button type="button" onClick={() => { setTaskForLaw(l.id); fetchTasksForLaw(l.id) }} title="Add task" className="text-blue-500 hover:text-blue-600 font-semibold text-[8px]">✓ +</button>
                      </>
                    )}
                  </div>
                  {menuLawId === l.id && (
                    <div className="flex gap-1 text-[8px]">
                      <button type="button" onClick={() => moveLawInOrder(`law-${l.id}`, 'up')} title="Move up" className="text-gray-500 hover:text-gray-700 font-semibold">▲</button>
                      <button type="button" onClick={() => moveLawInOrder(`law-${l.id}`, 'down')} title="Move down" className="text-gray-500 hover:text-gray-700 font-semibold">▼</button>
                      <button type="button" onClick={() => startEdit(l)} title="Edit" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                      <button type="button" onClick={() => { setReplyingTo(`law-${l.id}`); fetchReplies('law', l.id) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                      <button type="button" onClick={() => { remove(l.id); setMenuLawId(null) }} className="text-red-500 hover:text-red-700 font-semibold">×</button>
                    </div>
                  )}
                  {taskForLaw === l.id
                    ? renderAddTaskForm(taskTitle, setTaskTitle, taskType, setTaskType, taskAssignedTo, setTaskAssignedTo, addTaskForLaw, () => setTaskForLaw(null))
                    : (
                        <>
                          {renderAttachedItems(taskForLawLoaded[l.id], l.id, undefined)}
                          {renderReplyThread(`law-${l.id}`, 'law', l.id, 'lg')}
                        </>
                      )}
                </div>
              )}
            </div>
          ))}
          {(() => {
            const propertyTypeKeys = ['printers', 'computers']
            const propertyTypeFlags = orderedFlags.filter(f => propertyTypeKeys.includes(f.key.toLowerCase()))
            const otherFlags = orderedFlags.filter(f => !propertyTypeKeys.includes(f.key.toLowerCase()))

            return (
              <>
                {propertyTypeFlags.length > 0 && (
                  <div className="flex items-center gap-2 px-1 py-0.5 bg-purple-50/30">
                    <span className="shrink-0 text-[8px] font-bold text-gray-300">{visibleLaws.length + 1}</span>
                    <div className="flex items-center gap-3 flex-wrap min-w-0">
                      {propertyTypeFlags.filter(f => !hideZeroFlags || f.count > 0).map((f, typeIdx) => (
                        <div key={f.key}
                          className={`flex items-center gap-1.5 cursor-pointer px-1.5 py-0.5 rounded transition ${f.active ? 'bg-blue-200 ring-2 ring-blue-400' : 'hover:bg-purple-100'}`}
                          onMouseDown={() => flagPress.onMouseDown(f.key)} onMouseUp={flagPress.onMouseUp}
                          onTouchStart={() => flagPress.onTouchStart(f.key)} onTouchEnd={flagPress.onTouchEnd}>
                          <button type="button" onClick={f.onViewClick} className={`text-[9px] font-medium transition ${f.active ? 'text-blue-900 font-bold' : 'text-gray-800 hover:text-blue-600 hover:underline'}`}>
                            {VIEW_KEYS.includes(f.key) ? (customViewNames[f.key] || f.label) : (customFlagNames[f.key] || f.label)}
                          </button>
                          <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1 py-0 rounded text-center">{f.count}</span>
                          {menuFlagKey === f.key && (
                            <div className="flex gap-1 text-[8px]">
                              <button type="button" onClick={() => moveLawInOrder(f.key, 'up')} title="Move up" className="text-gray-500 hover:text-gray-700 font-semibold">▲</button>
                              <button type="button" onClick={() => moveLawInOrder(f.key, 'down')} title="Move down" className="text-gray-500 hover:text-gray-700 font-semibold">▼</button>
                              <button type="button" onClick={() => startEditFlag(f)} title="Rename" className="text-gray-500 hover:text-gray-700 font-semibold">✎</button>
                              {taskForFlag !== f.key && noteForFlag !== f.key && (
                                <>
                                  <button type="button" onClick={() => { setTaskForFlag(f.key); fetchTasksForFlag(f.key) }} title="Add task for this flag" className="text-blue-500 hover:text-blue-600 font-semibold text-[8px]">✓ +</button>
                                </>
                              )}
                            </div>
                          )}
                          {menuFlagKey !== f.key && (
                            <button type="button" onClick={() => setMenuFlagKey(f.key)} className="text-gray-400 hover:text-gray-600 text-[8px] font-semibold">⋯</button>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {otherFlags.filter(f => !hideZeroFlags || f.count > 0).map((f, i) => (
            <div key={f.key} className={`flex items-start gap-1 px-1 py-0.5 transition ${f.active ? 'bg-blue-100 ring-2 ring-inset ring-blue-400' : 'bg-red-50/30'}`}
              onMouseDown={() => flagPress.onMouseDown(f.key)} onMouseUp={flagPress.onMouseUp}
              onTouchStart={() => flagPress.onTouchStart(f.key)} onTouchEnd={flagPress.onTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{visibleLaws.length + (propertyTypeFlags.length > 0 ? 2 : 1) + i}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1 flex-wrap leading-none">
                  {editingFlagKey === f.key ? (
                    <>
                      <input autoFocus value={editFlagLabel} onChange={e => setEditFlagLabel(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Enter') { saveCustomFlagName(f.key, editFlagLabel); setEditingFlagKey(null) }
                          if (e.key === 'Escape') setEditingFlagKey(null)
                        }}
                        className="min-w-0 flex-1 text-[9px] bg-gray-100 border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
                      <button type="button" onClick={() => { saveCustomFlagName(f.key, editFlagLabel); setEditingFlagKey(null) }} title="Save"
                        className="shrink-0 text-green-600 hover:text-green-700 px-0.5 text-[8px] font-bold">✓</button>
                      <button type="button" onClick={() => setEditingFlagKey(null)} title="Cancel"
                        className="shrink-0 text-gray-400 hover:text-gray-600 px-0.5 text-[8px] font-bold">×</button>
                    </>
                  ) : (
                    <button type="button" onClick={f.onViewClick} className={`text-[9px] font-medium transition ${f.active ? 'text-blue-900 font-bold' : 'text-gray-800 hover:text-blue-600 hover:underline'}`}>
                      {VIEW_KEYS.includes(f.key) ? (customViewNames[f.key] || f.label) : (customFlagNames[f.key] || f.label)}
                    </button>
                  )}
                  {editingFlagKey !== f.key && f.description && (
                    <button type="button" onClick={() => setExpandedFlagDesc(expandedFlagDesc === f.key ? null : f.key)}
                      title="Show description"
                      className="text-gray-400 hover:text-gray-600 text-[8px] font-bold shrink-0">ⓘ</button>
                  )}
                  {editingFlagKey !== f.key && (
                    <span className="text-[8px] bg-red-100 text-red-700 font-bold px-1 py-0 rounded text-center">{f.count}</span>
                  )}
                  {editingFlagKey !== f.key && menuFlagKey === f.key ? (
                    <>
                      <button type="button" onClick={() => moveLawInOrder(f.key, 'up')} title="Move up" className="text-gray-500 hover:text-gray-700 text-[8px] font-semibold">▲</button>
                      <button type="button" onClick={() => moveLawInOrder(f.key, 'down')} title="Move down" className="text-gray-500 hover:text-gray-700 text-[8px] font-semibold">▼</button>
                      <button type="button" onClick={() => startEditFlag(f)} title="Rename" className="text-gray-500 hover:text-gray-700 text-[8px] font-semibold">✎</button>
                      {taskForFlag !== f.key && (
                        <>
                          <button type="button" onClick={() => { setTaskForFlag(f.key); fetchTasksForFlag(f.key) }} title="Add task for this flag" className="text-blue-500 hover:text-blue-600 font-semibold text-[8px]">✓ +</button>
                        </>
                      )}
                    </>
                  ) : editingFlagKey !== f.key && (
                    <button type="button" onClick={() => setMenuFlagKey(f.key)} className="text-gray-400 hover:text-gray-600 text-[8px] font-semibold">⋯</button>
                  )}
                </div>
                {expandedFlagDesc === f.key && f.description && (
                  <p className="text-[8px] text-gray-600 leading-tight">{f.description}</p>
                )}
                {taskForFlag === f.key
                  ? renderAddTaskForm(taskTitleForFlag, setTaskTitleForFlag, taskTypeForFlag, setTaskTypeForFlag, taskAssignedToFlag, setTaskAssignedToFlag, addTaskForFlag, () => setTaskForFlag(null))
                  : renderAttachedItems(tasksByFlagKey[f.key], undefined, f.key)}
              </div>
            </div>
          ))}
              </>
            )
          })()}
          {visibleGlobalTasks.map((task, i) => (
            <div key={`task-${task.id}`} className="px-1 py-0.5 bg-green-50/50 flex items-center gap-1"
              onMouseDown={() => globalTaskPress.onMouseDown(task.id)} onMouseUp={globalTaskPress.onMouseUp}
              onTouchStart={() => globalTaskPress.onTouchStart(task.id)} onTouchEnd={globalTaskPress.onTouchEnd}>
              <span className="shrink-0 text-[8px] font-bold text-gray-300">{visibleLaws.length + visibleFlags.length + i + 1}</span>
              <div className="min-w-0 flex-1">
                <p className="text-[9px] text-gray-800">✓ {task.title}</p>
                <div className="flex items-center gap-1 flex-wrap text-[7px] text-gray-600 mt-0.5">
                  <span>{formatDate(task.created_at)} by {task.created_by}</span>
                  {task.assigned_to && (<><span>•</span><span>To: {task.assigned_to}</span></>)}
                </div>
                {menuGlobalTaskId === task.id && (
                  <div className="flex gap-1 text-[8px] mt-0.5">
                    <button type="button" onClick={() => { toggleGlobalTaskCompletion(task.id, task.done); setMenuGlobalTaskId(null) }} title={task.done ? 'Reopen' : 'Complete'} className="text-green-600 hover:text-green-700 font-semibold">✓</button>
                    <button type="button" onClick={() => { setReplyingTo(`task-${task.id}`); fetchReplies('task', task.id); setMenuGlobalTaskId(null) }} title="Reply" className="text-blue-500 hover:text-blue-700 font-semibold">💬</button>
                    <button type="button" onClick={() => { deleteGlobalTask(task.id); setMenuGlobalTaskId(null) }} title="Delete task" className="text-red-500 hover:text-red-700 font-semibold">×</button>
                  </div>
                )}
                {renderReplyThread(`task-${task.id}`, 'task', task.id, 'sm')}
              </div>
            </div>
          ))}
          {isItemsLaws && openForm === 'task' && (
            <div className="px-1 py-1 bg-blue-50 border-t border-blue-200 flex flex-col gap-0.5 text-[8px]">
              <input autoFocus value={globalTaskTitle} onChange={e => setGlobalTaskTitle(e.target.value)} placeholder="Task…"
                onKeyDown={e => { if (e.key === 'Enter') addGlobalTask(); if (e.key === 'Escape') setOpenForm?.(null) }}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400" />
              <select value={globalTaskType} onChange={e => setGlobalTaskType(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                <option>General +</option>
                <option>App +</option>
                <option>Note</option>
              </select>
              <select value={globalTaskAssignedTo} onChange={e => setGlobalTaskAssignedTo(e.target.value)}
                className="flex-1 min-w-0 bg-white border border-gray-300 px-1 py-0.5 outline-none focus:ring-1 focus:ring-blue-400">
                <option value="">Assign to…</option>
                {ASSIGNABLE_STAFF.map(staff => <option key={staff} value={staff}>{staff}</option>)}
              </select>
              <div className="flex gap-0.5">
                <button type="button" onClick={addGlobalTask} className="flex-1 text-green-600 hover:text-green-700 font-bold">Create</button>
                <button type="button" onClick={() => setOpenForm?.(null)} className="shrink-0 text-gray-400 hover:text-gray-600 font-bold">×</button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
