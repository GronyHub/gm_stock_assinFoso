'use client'

import { useEffect, useState } from 'react'

export interface FetchState<T> {
  loading: boolean
  error: string | null
  data: T | null
}

export function useFetch<T>(
  url: string | null | undefined,
  options?: RequestInit & { skip?: boolean }
): FetchState<T> {
  const [state, setState] = useState<FetchState<T>>({
    loading: !!url && !options?.skip,
    error: null,
    data: null,
  })

  useEffect(() => {
    if (!url || options?.skip) {
      setState({ loading: false, error: null, data: null })
      return
    }

    let cancelled = false

    const fetch_data = async () => {
      try {
        setState({ loading: true, error: null, data: null })
        const res = await fetch(url, options)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const json = await res.json()
        if (!cancelled) setState({ loading: false, error: null, data: json })
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : String(err)
          setState({ loading: false, error: message, data: null })
        }
      }
    }

    fetch_data()
    return () => {
      cancelled = true
    }
  }, [url, options])

  return state
}
