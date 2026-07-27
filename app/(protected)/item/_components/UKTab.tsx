'use client'
import { useState } from 'react'
import { useSession } from 'next-auth/react'

const PEOPLE = ['Grony', 'Mina', 'Prisca'] as const
type Person = typeof PEOPLE[number]

// Private to Grony alone -- the hamburger menu only ever renders the link
// to this page for that one username (see isGrony in page.tsx), but the
// page itself re-checks the session too, same as Personal's own gate,
// so a direct URL visit by anyone else still hits a private wall.
export default function UKTab() {
  const { data: session } = useSession()
  const username = ((session?.user as any)?.username ?? session?.user?.name ?? '').toLowerCase()
  const [person, setPerson] = useState<Person>('Grony')

  if (username !== 'grony') {
    return (
      <div className="py-20 text-center space-y-2">
        <p className="text-2xl">🔒</p>
        <p className="text-gray-500 text-sm">This page is private.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4 pb-10">
      <div>
        <h1 className="text-lg font-bold text-gray-900">UK</h1>
        <p className="text-[10px] text-gray-400">Private · Grony only</p>
      </div>
      <div className="flex gap-1.5">
        {PEOPLE.map(p => (
          <button key={p} onClick={() => setPerson(p)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition
              ${person === p ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {p}
          </button>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-xl p-6 text-center text-gray-400 text-sm">
        Nothing here yet for {person}.
      </div>
    </div>
  )
}
