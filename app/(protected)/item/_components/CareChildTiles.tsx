'use client'
import { useEffect, useState } from 'react'
import { CHILDREN } from '@/lib/caretakerShared'

type ChildInfo = { name: string; photo_url: string | null }

// The four children, as photo tiles at the top of the left pane. Tapping one
// opens that child's page (their records, routine and history) in Care Today.
export default function CareChildTiles({ onOpen }: { onOpen: (name: string) => void }) {
  const [kids, setKids] = useState<ChildInfo[]>(CHILDREN.map(name => ({ name, photo_url: null })))
  useEffect(() => {
    fetch('/api/caretaker/children').then(r => r.json()).then(d => { if (Array.isArray(d)) setKids(d) }).catch(() => {})
  }, [])
  return (
    <div className="grid grid-cols-2 gap-1 px-1 pb-1">
      {kids.map(k => (
        <button key={k.name} type="button" onClick={() => onOpen(k.name)}
          className="flex flex-col items-center gap-0.5 rounded-lg bg-white/10 py-1.5 active:bg-white/20">
          {k.photo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={k.photo_url} alt={k.name} className="h-11 w-11 rounded-full object-cover" />
            : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-200 text-base font-bold text-blue-800">{k.name[0]}</span>}
          <span className="text-[10px] font-semibold text-white">{k.name}</span>
        </button>
      ))}
    </div>
  )
}
