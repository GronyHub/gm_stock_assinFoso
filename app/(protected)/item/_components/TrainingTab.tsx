'use client'
import { useState } from 'react'
import ContentPage from './ContentPage'
import AssessmentPanel from './AssessmentPanel'

type TrainingView = 'tutorial' | 'laws' | 'assessment'

const SUBMENU: { key: TrainingView; label: string }[] = [
  { key: 'tutorial', label: '📖 Tutorial' },
  { key: 'laws', label: '⚖️ Company Laws' },
  { key: 'assessment', label: '🧪 Assessment' },
]

// Grony Manage > Training: how the app works (kept up to date as it
// changes), the company's own rules, and quizzes staff can take to check
// their understanding of both.
export default function TrainingTab() {
  const [view, setView] = useState<TrainingView>('tutorial')

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="flex items-center gap-1 px-2 py-1 bg-gray-50 border-b border-gray-100 overflow-x-auto shrink-0">
        {SUBMENU.map(v => (
          <button key={v.key} onClick={() => setView(v.key)}
            className={`shrink-0 text-xs font-semibold px-2.5 py-1 rounded-lg whitespace-nowrap transition
              ${view === v.key ? 'bg-blue-600 text-white' : 'bg-white border border-blue-200 text-blue-700 hover:bg-blue-100'}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto">
        {view === 'tutorial' && <ContentPage contentKey="training_tutorial" title="📖 App Tutorial" />}
        {view === 'laws' && <ContentPage contentKey="training_laws" title="⚖️ Company Laws" />}
        {view === 'assessment' && <AssessmentPanel />}
      </div>
    </div>
  )
}
