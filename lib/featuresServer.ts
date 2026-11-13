import sql from '@/lib/db'
import { SWITCHES_KEY, withDefaults, type FeatureKey } from '@/lib/features'

// The server's view of the on/off switches (lib/features.ts), read at most once every 30 seconds.
let cache: { at: number; v: Record<FeatureKey, boolean> } | null = null
export async function featureOn(key: FeatureKey): Promise<boolean> {
  if (!cache || Date.now() - cache.at > 30000) {
    try {
      const [row] = await sql`SELECT value_json FROM app_settings WHERE setting_key = ${SWITCHES_KEY}`
      cache = { at: Date.now(), v: withDefaults(row ? JSON.parse(String(row.value_json)) : null) }
    } catch { cache = { at: Date.now(), v: withDefaults(null) } }
  }
  return cache.v[key]
}
export const clearFeatureCache = () => { cache = null }
