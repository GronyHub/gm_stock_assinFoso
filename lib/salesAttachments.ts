import sql from './db'
import { once } from '@/lib/once'

export type Attachment = { url: string; type: string; name: string }

async function ensureSalesAttachmentsColumnImpl() {
  await sql`ALTER TABLE sales_receipts ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb`.catch(() => {})
}

export function normalizeAttachments(input: unknown): Attachment[] {
  if (!Array.isArray(input)) return []
  return input
    .filter((a): a is { url: string; type?: string; name?: string } =>
      !!a && typeof a === 'object' && typeof (a as Record<string, unknown>).url === 'string')
    .map(a => ({ url: a.url, type: a.type ?? '', name: a.name ?? '' }))
}

export const ensureSalesAttachmentsColumn = once(ensureSalesAttachmentsColumnImpl)
