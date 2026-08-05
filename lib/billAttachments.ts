import sql from './db'

export type Attachment = { url: string; type: string; name: string }

export async function ensureBillAttachmentsColumn() {
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb`.catch(() => {})
}

export function normalizeAttachments(input: unknown): Attachment[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((a): a is { url: string; type?: string; name?: string } =>
      !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).url === 'string')
    .map(a => ({ url: a.url, type: a.type ?? '', name: a.name ?? '' }))
}
