'use client'
import { useState } from 'react'
import DynamicTasksSection from './DynamicTasksSection'
import PageLawsNote from './PageLawsNote'

// Small ⚖️/✅ icon pair replacing the large inline DynamicTasksSection block
// that used to sit at the top of every page -- same content, just tucked
// into a popover instead of permanently occupying page space.
export default function PageToolIcons({ scopeKey }: { scopeKey: string }) {
  const [open, setOpen] = useState<'tasks' | 'laws' | null>(null)

  return (
    <div className="flex items-center gap-1.5">
      <button onClick={() => setOpen('laws')} title="Page notes/laws"
        className="text-sm leading-none px-1.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
        ⚖️
      </button>
      <button onClick={() => setOpen('tasks')} title="Tasks"
        className="text-sm leading-none px-1.5 py-1 rounded-lg bg-gray-100 hover:bg-gray-200 transition">
        ✅
      </button>
      {open && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setOpen(null)}>
          <div className="bg-white w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl max-h-[85dvh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100 sticky top-0 bg-white z-10">
              <p className="text-sm font-bold text-gray-900">{open === 'tasks' ? '✅ Tasks' : '⚖️ Notes'}</p>
              <button onClick={() => setOpen(null)} className="text-gray-400 hover:text-gray-600 text-xl font-bold leading-none">×</button>
            </div>
            <div className="p-2">
              {open === 'tasks' ? <DynamicTasksSection scopeKey={scopeKey} /> : <PageLawsNote scopeKey={scopeKey} />}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
