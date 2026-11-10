// Client-safe constants and types for the shop routine.
export const ROUTINE_SECTIONS = ['Opening', 'Daytime', 'Closing'] as const

export type ShopTile = { id: number; section: string; time: string | null; title: string; position: number }
export type ShopEvent = {
  id: number; routine_id: number; value: string; note: string | null
  extra: { minutes?: number; support?: 'alone' | 'support'; done_at?: string } | null
  recorded_by: string; recorded_at: string
}

