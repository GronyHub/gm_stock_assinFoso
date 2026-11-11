'use client'
import { useState } from 'react'
import { TimesTab } from '../../staff/StaffClient'
import ShopRota from './ShopRota'

// The Shop's "Times" tab: the whole team's times in one grid: the days to come (planned on the rota), today, and the recorded past.
// Read only: staff clock in and out from the Times tab on their own profile. The owner and Joe get a small calendar icon to plan the rota.
export default function ShopTeamTimes({ username, role, canManage }: { username: string; role: string; canManage: boolean }) {
  const [plan, setPlan] = useState(false)
  return (
    <div className="space-y-2">
      {plan && canManage && <ShopRota canManage />}
      <TimesTab username={username} role={role} readOnly extraToolbar={canManage ? (
        <button type="button" onClick={() => setPlan(p => !p)} title="Plan the rota" aria-label="Plan the rota"
          className={`flex h-8 w-8 items-center justify-center rounded-lg border text-base ${plan ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}>🗓</button>
      ) : undefined} />
    </div>
  )
}
