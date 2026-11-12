'use client'
import { useEffect, useState } from 'react'
import TaskTile, { type TileDensity } from '@/components/TaskTile'

// A tile among the day's duties, shown only while the shop holds open pending jobs: how many are open, ready to collect and overdue.
export default function PendingJobsDue({ density = 'compact' }: { density?: TileDensity }) {
  const [c, setC] = useState<{ open: number; ready: number; overdue: number } | null>(null)
  useEffect(() => { fetch('/api/pending-jobs?count=1', { cache: 'no-store' }).then(r => r.ok ? r.json() : null).then(setC).catch(() => {}) }, [])
  if (!c || c.open === 0) return null
  const open = () => { if (window.parent !== window) window.parent.postMessage({ type: 'open-path', path: '/pending-jobs' }, window.location.origin); else window.location.href = '/pending-jobs' }
  return <TaskTile density={density} icon="🧾" time="Daily" title={`Pending jobs: ${c.open} open`} detail={`${c.ready ? `${c.ready} ready to collect. ` : ''}${c.overdue ? `${c.overdue} overdue. ` : ''}Confirm you are working on them.`}
    category="Customer service" type="Recurring task" tone={c.overdue ? 'border-red-300 bg-red-50' : 'border-amber-300 bg-amber-50'} onClick={open} />
}
