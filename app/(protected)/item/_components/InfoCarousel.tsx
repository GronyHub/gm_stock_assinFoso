'use client'
import { useState, useEffect } from 'react'

type InfoItem = {
  id: string
  text: string
  icon: string
  variant: 'info' | 'warning' | 'success'
}

const INFO_ITEMS: InfoItem[] = [
  {
    id: 'gmc-overage',
    text: '📦 If a pack shows "usage exceeds" amount given, a physical count is needed.',
    icon: '⚠️',
    variant: 'warning',
  },
  {
    id: 'break-timer',
    text: '☕ Use "Take a Break" button when stepping away for >30 min to keep attendance accurate.',
    icon: '⏱️',
    variant: 'info',
  },
  {
    id: 'live-sale',
    text: '💳 Verify item quantity & price before tapping. Check material stock for services.',
    icon: '✓',
    variant: 'success',
  },
  {
    id: 'data-cache',
    text: '📊 Some dashboards cache data up to 2 hours. Check specific reports for real-time data.',
    icon: 'ℹ️',
    variant: 'info',
  },
  {
    id: 'location-required',
    text: '📍 GPS required to clock in/out. Make sure location services are enabled.',
    icon: '📱',
    variant: 'warning',
  },
  {
    id: 'daily-count',
    text: '📋 Openers must confirm daily stock counts after clocking in.',
    icon: '☑️',
    variant: 'info',
  },
]

export default function InfoCarousel() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isVisible, setIsVisible] = useState(true)
  const [isPaused, setIsPaused] = useState(false)

  useEffect(() => {
    if (!isVisible || isPaused || INFO_ITEMS.length === 0) return

    const timer = setInterval(() => {
      setCurrentIndex(prev => (prev + 1) % INFO_ITEMS.length)
    }, 6000)

    return () => clearInterval(timer)
  }, [isVisible, isPaused])

  if (!isVisible) return null

  const current = INFO_ITEMS[currentIndex]
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
            {INFO_ITEMS.map((_, idx) => (
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
