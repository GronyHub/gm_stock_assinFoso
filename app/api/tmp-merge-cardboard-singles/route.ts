import { mergeItems } from '@/lib/mergeItems'
import { NextResponse } from 'next/server'

export async function POST() {
  const result = await mergeItems(196, 372)
  return NextResponse.json(result)
}
