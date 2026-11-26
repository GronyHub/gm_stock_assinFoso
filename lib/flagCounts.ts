import { openKeysAll } from '@/lib/flagLaws'

// How many items are open on each flag right now (a flag that could not be read this time is left out, never shown as zero).
export async function openFlagCounts(): Promise<Record<string, number>> {
  const { keys, ok } = await openKeysAll(), out: Record<string, number> = {}
  for (const k of ok) out[k] = keys[k]?.length ?? 0
  return out
}
