'use client'

import { useState } from 'react'

export interface SaveState {
  saving: boolean
  error: string | null
  success: boolean
}

export function useSavingState(initialError: string | null = null) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(initialError)
  const [success, setSuccess] = useState(false)

  const reset = () => {
    setSaving(false)
    setError(null)
    setSuccess(false)
  }

  const setApiError = (err: unknown) => {
    const message = err instanceof Error ? err.message : String(err)
    setError(message)
  }

  const clearError = () => setError(null)

  const showSuccess = (duration = 2000) => {
    setSuccess(true)
    setError(null)
    setTimeout(() => setSuccess(false), duration)
  }

  return {
    saving,
    setSaving,
    error,
    setError,
    setApiError,
    clearError,
    success,
    showSuccess,
    reset,
  }
}
