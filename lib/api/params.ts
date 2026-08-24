import { badRequest } from './responses'

export async function getIdParam(params: Promise<{ id: string }>) {
  const { id } = await params
  return Number(id)
}

export async function getIdParamWithValidation(params: Promise<{ id: string }>) {
  const { id } = await params
  const numId = Number(id)
  if (!numId || isNaN(numId)) {
    return { error: badRequest('Invalid ID') }
  }
  return { id: numId }
}

export async function getStringParam(params: Promise<{ id: string }>) {
  const { id } = await params
  return id
}

export async function getStringParamWithValidation(params: Promise<{ id: string }>) {
  const { id } = await params
  if (!id || id.trim() === '') {
    return { error: badRequest('Invalid parameter') }
  }
  return { id }
}
