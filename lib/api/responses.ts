import { NextResponse } from 'next/server'

export function badRequest(message: string): NextResponse {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized(): NextResponse {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function notFound(): NextResponse {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function serverError(message: string, detail?: string): NextResponse {
  const fullMessage = detail ? `${message}: ${detail}` : message
  return NextResponse.json({ error: fullMessage }, { status: 500 })
}

export function success<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(data, { status })
}

export function ok(): NextResponse {
  return NextResponse.json({ ok: true })
}

export function handleError(context: string, error: unknown): NextResponse {
  console.error(`${context}:`, error)
  const detail = error instanceof Error ? error.message : String(error)
  return serverError('Server error', detail)
}
