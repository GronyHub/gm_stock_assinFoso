import { NextResponse } from 'next/server'

export function badRequest(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}

export function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

export function notFound() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 })
}

export function serverError(message: string, detail?: string) {
  const fullMessage = detail ? `${message}: ${detail}` : message
  return NextResponse.json({ error: fullMessage }, { status: 500 })
}

export function success(data: any) {
  return NextResponse.json(data)
}

export function ok() {
  return NextResponse.json({ ok: true })
}

export function handleError(context: string, error: unknown) {
  console.error(`${context}:`, error)
  const detail = error instanceof Error ? error.message : String(error)
  return serverError('Server error', detail)
}
