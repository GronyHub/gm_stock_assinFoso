'use client'
import { useState, useEffect } from 'react'

type InfoItem = {
  id: string
  title: string
  message: string
  icon: string
  variant: 'info' | 'warning' | 'success' | 'tip'
}

const INFO_ITEMS: InfoItem[] = [
  {
    id: 'gmc-overage',
    title: '📦 GMC Overage Warning',
    message: 'If a pack shows "usage exceeds" the amount given, a physical count is needed to find out if a pack is short or if one was already opened but never recorded.',
    icon: '⚠️',
    variant: 'warning',
  },
  {
    id: 'break-timer',
    title: '☕ Mark Your Breaks',
    message: 'Use the "Take a Break" button in your Times tab when stepping away for more than 30 minutes. This keeps your attendance record accurate.',
    icon: '⏱️',
    variant: 'info',
  },
  {
    id: 'live-sale',
    title: '💳 Live Sale Tips',
    message: 'Always verify item quantity and price before tapping. Check material stock for services to avoid overselling.',
    icon: '✓',
    variant: 'success',
  },
  {
    id: 'data-cache',
    title: '📊 Data Updates',
    message: 'Some dashboards cache data for up to 2 hours to reduce database load. For real-time data, check the specific report directly.',
    icon: 'ℹ️',
    variant: 'info',
  },
  {
    id: 'location-required',
    title: '📍 Location Required',
    message: 'You must be at the shop and have GPS enabled to clock in or out. Make sure location services are turned on.',
    icon: '📱',
    variant: 'warning',
  },
  {
    id: 'daily-count',
    title: '📋 Daily Opening Counts',
    message: 'Openers must confirm today\'s stock counts after clocking in. This is required before your clock-in is complete.',
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
    }, 8000)

    return () => clearInterval(timer)
  }, [isVisible, isPaused])

  if (!isVisible) return null

  const current = INFO_ITEMS[currentIndex]
  const variantClasses = {
    info: 'bg-blue-50 border-blue-200 text-blue-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    success: 'bg-green-50 border-green-200 text-green-900',
    tip: 'bg-purple-50 border-purple-200 text-purple-900',
  }

  return (
    <div
      className={`border-b ${variantClasses[current.variant]} transition-colors duration-500`}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="mx-auto px-4 py-3 flex items-start justify-between gap-3">
        <div className="flex gap-3 flex-1 min-w-0">
          <span className="text-xl shrink-0">{current.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold">{current.title}</p>
            <p className="text-xs opacity-90 mt-0.5">{current.message}</p>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="shrink-0 text-lg leading-none opacity-60 hover:opacity-100 transition-opacity"
          title="Dismiss this info bar"
        >
          ×
        </button>
      </div>
      {INFO_ITEMS.length > 1 && (
        <div className="px-4 pb-2 flex gap-1 justify-center">
          {INFO_ITEMS.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrentIndex(idx)}
              className={`w-1.5 h-1.5 rounded-full transition-opacity ${
                idx === currentIndex ? 'opacity-60' : 'opacity-20'
              }`}
              style={{
                backgroundColor:
                  current.variant === 'info'
                    ? '#1e40af'
                    : current.variant === 'warning'
                      ? '#b45309'
                      : current.variant === 'success'
                        ? '#166534'
                        : '#6b21a8',
              }}
              title={`Go to info ${idx + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  )
}
