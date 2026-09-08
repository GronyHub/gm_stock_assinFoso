import sql from './db'
import { once } from '@/lib/once'

export type Attachment = { url: string; type: string; name: string }

async function ensureBillAttachmentsColumnImpl() {
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb`.catch(() => {})
}

// bills.entered_by was always referenced (POST's insert, this file's own PUT
// handler) but never actually added to the table -- every insert silently
// fell back to a no-entered_by retry, and the PUT handler had no fallback at
// all, so editing a bill's date/vendor errored outright with "column
// entered_by does not exist".
async function ensureBillEnteredByColumnImpl() {
  await sql`ALTER TABLE bills ADD COLUMN IF NOT EXISTS entered_by TEXT`.catch(() => {})
}

export function normalizeAttachments(input: unknown): Attachment[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((a): a is { url: string; type?: string; name?: string } =>
      !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).url === 'string')
    .map(a => ({ url: a.url, type: a.type ?? '', name: a.name ?? '' }))
}

export const ensureBillAttachmentsColumn = once(ensureBillAttachmentsColumnImpl)
export const ensureBillEnteredByColumn = once(ensureBillEnteredByColumnImpl)
