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
      className={`border-b ${variantClasses[current.variant]} transition-colors duration-300 text-xs`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="px-4 py-1.5 flex items-center justify-between gap-3">
        <span className="text-sm">{current.text}</span>
        <div className="flex gap-2 items-center shrink-0">
          <div className="flex gap-1">
            {items.map((_, idx) => (
              <button
                key={idx}
                onClick={() => setCurrentIndex(idx)}
                className={`w-1 h-1 rounded-full transition-opacity ${
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
            className="text-gray-400 hover:text-gray-600 leading-none px-1"
            title="Dismiss"
          >
            ×
          </button>
        </div>
      </div>
    </div>
  )
}
