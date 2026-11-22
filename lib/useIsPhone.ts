'use client'
import { useEffect, useState } from 'react'

// True on a phone-sized screen (under 640px, the same break as Tailwind's `sm`). Used by the Cash pages that draw cards on a phone and a table on a larger screen.
export function useIsPhone(): boolean {
  const [phone, setPhone] = useState(false)
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 639px)')
    const on = () => setPhone(mq.matches)
    on()
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return phone
}
