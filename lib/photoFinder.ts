// Finds free-licence photos for an item on Wikimedia Commons, by the item's name. Nothing here attaches a photo:
// staff look at the matches on Advert > Item Photos and tap the one they approve (see
// app/api/items/[id]/picture/web/route.ts). Only Commons is used because every file there has a known licence, and
// only licences that allow use in adverts are kept (public domain, CC0, CC BY, CC BY-SA) -- never NC (non-commercial)
// or ND (no changes) ones.

const UA = 'GronyStockApp/1.0 (https://app.gronymultimedia.com; item photo finder)'
// Commons' own file hosts (full-size files, and resized copies). Photos are only ever downloaded from these.
export const COMMONS_HOSTS = ['upload.wikimedia.org', 'thumb.wikimedia.org']

export type PhotoMatch = { title: string; thumb: string; full: string; page: string; licence: string; author: string; width: number; height: number }

// Words in shop item names that only describe how the item is sold, not what it is.
const NOISE = /\b(singles?|sing\.?|packs?|pcs|for shop use|for sale|shop use|double|d|s|one side|unspecified|pre-zoho|goods)\b/gi

// A short hint per item group, added when the item's own name doesn't say what the thing is ("85A" -> toner).
const GROUP_HINT: Record<string, string> = {
  'toner cartridges': 'toner cartridge', 'toner refills': 'toner powder', 'toner blades': 'toner cartridge blade',
  'hp blades & drums': 'printer drum unit', 'drums': 'printer drum unit', 'inks': 'printer ink bottle',
  'cables': 'cable', 'chargers': 'laptop charger', 'connectors': 'adapter', 'converters': 'adapter',
  'mouse': 'computer mouse', 'keyboards': 'computer keyboard', 'storage devices': 'storage', 'storage': 'storage',
  'batteries': 'battery', 'gamepads & speakers': 'gamepad', 'photo papers': 'photo paper', 'plain papers': 'paper sheets',
  'stationery': 'stationery', 'large format': 'large format printing', 'other computer accessories': 'computer accessory',
}

export function suggestQuery(name: string, group?: string | null): string {
  let q = name.replace(/[^\p{L}\p{N} +./-]/gu, ' ').replace(NOISE, ' ').replace(/\s+/g, ' ').trim()
  const hint = GROUP_HINT[(group ?? '').trim().toLowerCase()]
  if (hint && !hint.split(' ').some(w => q.toLowerCase().includes(w.replace(/s$/, '')))) q = `${q} ${hint}`
  return q
}

const OK_LICENCE = /^(public domain|pd|cc0|cc[ -]by(-sa)?( [\d.]+)?)/i
const BAD_LICENCE = /\b(nc|nd|fair use|non-?commercial)\b/i
const strip = (html: string) => html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim()

async function searchOnce(q: string, limit: number): Promise<PhotoMatch[]> {
  const u = new URL('https://commons.wikimedia.org/w/api.php')
  Object.entries({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: String(Math.min(limit * 2, 30)),
    gsrsearch: `${q} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|mime|size', iiurlwidth: '1200',
    iiextmetadatafilter: 'LicenseShortName|Artist', origin: '*',
  }).forEach(([k, v]) => u.searchParams.set(k, v))
  let r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) })
  if (r.status === 429) { // Commons asks callers to slow down: wait what it says (at most 3 s) and try once more
    await new Promise(res => setTimeout(res, Math.min(3, Number(r.headers.get('retry-after')) || 1) * 1000))
    r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(12000) })
  }
  if (r.status === 429) throw new Error('Wikimedia Commons is busy. Wait a minute and search again.')
  if (!r.ok) throw new Error(`Wikimedia Commons answered ${r.status}`)
  const d = await r.json() as { query?: { pages?: Record<string, { index: number; title: string; imageinfo?: Array<Record<string, unknown>> }> } }
  const pages = Object.values(d.query?.pages ?? {}).sort((a, b) => a.index - b.index)
  const out: PhotoMatch[] = []
  for (const p of pages) {
    const ii = p.imageinfo?.[0] as { mime?: string; thumburl?: string; url?: string; descriptionurl?: string; width?: number; height?: number; extmetadata?: Record<string, { value?: string }> } | undefined
    if (!ii || !/^image\/(jpeg|png|webp)$/.test(ii.mime ?? '')) continue
    const licence = strip(ii.extmetadata?.LicenseShortName?.value ?? '')
    if (!OK_LICENCE.test(licence) || BAD_LICENCE.test(licence)) continue
    if ((ii.width ?? 0) < 300 || (ii.height ?? 0) < 300) continue
    const full = ii.thumburl ?? ii.url ?? ''
    if (!full || !COMMONS_HOSTS.includes(new URL(full).hostname)) continue
    out.push({
      title: p.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''), thumb: full.replace(/\/\d+px-/, '/330px-'), full,
      page: ii.descriptionurl ?? '', licence, author: strip(ii.extmetadata?.Artist?.value ?? '').slice(0, 120) || 'Unknown',
      width: ii.width ?? 0, height: ii.height ?? 0,
    })
    if (out.length >= limit) break
  }
  return out
}

// Tries the full words first, then without sizes / model numbers ("HDMI CABLE 5M" -> "HDMI CABLE",
// "85A Toner Cartridge" -> "Toner Cartridge"), then just the group's kind of thing.
export async function findPhotos(q: string, limit = 8, group?: string | null): Promise<{ query: string; matches: PhotoMatch[] }> {
  const plain = q.split(' ').filter(w => !/\d/.test(w)).join(' ')
  const hint = GROUP_HINT[(group ?? '').trim().toLowerCase()] ?? ''
  const tries = [q, plain, hint].map(t => t.trim()).filter((t, i, a) => t.length > 1 && a.indexOf(t) === i)
  for (const t of tries) {
    const m = await searchOnce(t, limit)
    if (m.length) return { query: t, matches: m }
  }
  return { query: q, matches: [] }
}
