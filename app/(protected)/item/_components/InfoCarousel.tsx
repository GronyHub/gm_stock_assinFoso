'use client'
import { useState, useEffect } from 'react'

type InfoItem = {
  id: number
  text: string
  icon: string
  variant: 'info' | 'warning' | 'success'
}

export default function InfoCarousel() {
  const [items, setItems] = useState<InfoItem[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    fetch('/api/carousel-items').then(r => r.json()).then(setItems).catch(() => setItems([]))
  }, [])

  useEffect(() => {
    if (!isVisible || isPaused || items.length === 0) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % items.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [isVisible, isPaused, items.length])

  if (!isVisible || items.length === 0) return null

  const current = items[currentIndex]
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200',
    warning: 'bg-amber-50 border-amber-200',
    success: 'bg-green-50 border-green-200',
  }

  return (
    <div
      className={`border-b ${variantClasses[current.variant]} transition-colors duration-300 whitespace-nowrap`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="px-2 py-0.5 flex items-center justify-between gap-2">
        <span className="text-[10px]">{current.text}</span>
        <div className="flex gap-1 items-center shrink-0">
          <div className="flex gap-0.5">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-0.5 h-0.5 rounded-full transition-opacity ${
                  idx === currentIndex ? 'opacity-60' : 'opacity-20'
                }`}
                style={{
                  backgroundColor:
                    current.variant === 'info'
                      ? '#1e40af'
                      : current.variant === 'warning'
                        ? '#b45309'
                        : '#166534',
                }}
              />
            ))}
          </div>
          <button
            onClick={() => setIsVisible(false)}
            className="text-gray-400 hover:text-gray-600 leading-none px-0.5 text-[10px]"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
