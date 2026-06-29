const DAY = ['Su', 'M', 'Tu', 'W', 'Th', 'F', 'Sa']
const MON = ['Jan.', 'Feb.', 'Mar.', 'Apr.', 'May.', 'Jun.', 'Jul.', 'Aug.', 'Sep.', 'Oct.', 'Nov.', 'Dec.']

function ordinal(n: number) {
  if (n === 1 || n === 21 || n === 31) return 'st'
  if (n === 2 || n === 22) return 'nd'
  if (n === 3 || n === 23) return 'rd'
  return 'th'
}

export function fmtDate(raw: string | null | undefined): string {
  if (!raw) return '—'
  const d = new Date(raw.length === 10 ? raw + 'T00:00:00' : raw)
  if (isNaN(d.getTime())) return String(raw)
  const day = d.getDate()
  const yr = String(d.getFullYear()).slice(-2)
  return `${day} ${MON[d.getMonth()]} '${yr}-${DAY[d.getDay()]}`
}
