'use client'
import { useState, useEffect } from 'react'

type Law = {
  id: number
  text: string
  created_at: string
  display_in_carousel?: boolean
  carousel_message?: string | null
  carousel_order?: number | null
  carousel_type?: 'help' | 'law' | 'announcement'
}

type Task = {
  id: number
  title: string
  notes?: string
  done: boolean
  created_by: string
  created_at: string
  assigned_to?: string
}

export default function LawsTasksViewer({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [laws, setLaws] = useState<Law[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTab, setActiveTab] = useState<'laws' | 'tasks'>('laws')

  useEffect(() => {
    if (!isOpen) return
    fetch('/api/page-laws?scopeKey=items').then(r => r.json()).then(setLaws).catch(() => setLaws([]))
    fetch('/api/tasks?scope_key=items').then(r => r.json()).then(setTasks).catch(() => setTasks([]))
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[65] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-xl w-full max-w-2xl h-[90vh] shadow-2xl flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="shrink-0 border-b border-gray-200 px-4 py-3 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">Laws & Tasks (Temp Viewer)</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">✕</button>
        </div>

        {/* Tabs */}
        <div className="shrink-0 border-b border-gray-200 flex gap-4 px-4 py-2">
          <button
            onClick={() => setActiveTab('laws')}
            className={`text-sm font-semibold pb-2 border-b-2 ${activeTab === 'laws' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            Laws ({laws.length})
          </button>
          <button
            onClick={() => setActiveTab('tasks')}
            className={`text-sm font-semibold pb-2 border-b-2 ${activeTab === 'tasks' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'}`}
          >
            Tasks ({tasks.length})
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeTab === 'laws' && (
            <>
              {laws.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No laws found</p>
              ) : (
                laws.map(law => (
                  <div key={law.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 flex-1">{law.text}</p>
                      <span className="text-xs px-2 py-1 rounded bg-gray-200 text-gray-700 shrink-0">
                        {law.carousel_type || 'law'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-600 space-y-1">
                      <p>📌 In carousel: {law.display_in_carousel ? '✓ Yes' : '✗ No'}</p>
                      {law.carousel_message && <p>💬 Message: {law.carousel_message}</p>}
                      {law.carousel_order !== null && law.carousel_order !== undefined && (
                        <p>🔢 Order: {law.carousel_order}</p>
                      )}
                      <p>📅 Created: {new Date(law.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </>
          )}

          {activeTab === 'tasks' && (
            <>
              {tasks.length === 0 ? (
                <p className="text-gray-400 text-center py-8">No tasks found</p>
              ) : (
                tasks.map(task => (
                  <div key={task.id} className="border border-gray-200 rounded-lg p-3 space-y-2 bg-gray-50">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-semibold text-gray-900 flex-1">{task.title}</p>
                      <span className={`text-xs px-2 py-1 rounded shrink-0 ${task.done ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                        {task.done ? '✓ Done' : '⏳ Pending'}
                      </span>
                    </div>
                    {task.notes && <p className="text-sm text-gray-700">{task.notes}</p>}
                    <div className="text-xs text-gray-600 space-y-1">
                      {task.assigned_to && <p>👤 Assigned to: {task.assigned_to}</p>}
                      <p>👤 Created by: {task.created_by}</p>
                      <p>📅 Created: {new Date(task.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>
                ))
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="shrink-0 border-t border-gray-200 bg-blue-50 px-4 py-2 text-xs text-blue-800">
          ℹ️ <strong>Temp viewer:</strong> Use Handbook (📖) to edit. This shows what transferred from the old modal.
        </div>
      </div>
    </div>
  )
}
