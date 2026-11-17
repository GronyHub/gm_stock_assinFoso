// A law is a rule; a violation is one specific way of failing it. Every law has at least one violation line, each with its
// points. Most are logged by a manager who sees it in the shop or on the CCTV ('manager'); a few the app can see itself ('app').
export type Violation = { text: string; points: number; by: 'manager' | 'app'; how?: string; chapter?: string; record?: string; dismissal?: boolean }

export function parseViolations(raw: unknown): Violation[] {
  let v: unknown = raw
  if (typeof raw === 'string') { try { v = JSON.parse(raw) } catch { v = [] } }
  if (!Array.isArray(v)) return []
  const out: Violation[] = []
  for (const x of v) {
    const text = String((x as Violation)?.text ?? '').trim().slice(0, 300)
    if (!text) continue
    const dismissal = (x as Violation)?.dismissal === true
    let points = Math.round(Number((x as Violation)?.points)); if (!Number.isFinite(points) || points < 0 || points > 20) points = 1 // 0 = a rule with no penalty
    if (dismissal) points = 50
    const how = String((x as Violation)?.how ?? '').trim().slice(0, 800), chapter = String((x as Violation)?.chapter ?? '').trim().slice(0, 120)
    const record = String((x as Violation)?.record ?? '').trim().slice(0, 200)
    out.push({ text, points, by: (x as Violation)?.by === 'app' ? 'app' : 'manager', ...(how ? { how } : {}), ...(chapter ? { chapter } : {}), ...(record ? { record } : {}), ...(dismissal ? { dismissal: true } : {}) })
  }
  return out.slice(0, 12)
}
