// What the coming dates hold in To do (see app/api/todo/route.ts).
export type AheadItem = { key: string; kind: 'law' | 'oneoff'; freq: string; time: string | null; title: string; band: 'opener' | 'daytime' | 'closer' | 'oneoff'; who: string | null; role: string | null; law_id: number | null; note: string | null; minutes: number | null; category?: string | null; lawType?: string | null }
export type AheadDay = { date: string; rota: { opener: string | null; closer: string | null } | null; items: AheadItem[] }
