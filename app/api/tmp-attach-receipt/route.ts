import sql from '@/lib/db'
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

type Attachment = { url: string; type: string; name: string }

// Mirrors /api/sales/upload's own blob-store call exactly (same access
// level, same URL scheme) so attachments created this way are
// indistinguishable from ones a staff member uploaded by hand. Accepts
// base64 file content directly (no session/auth -- see this session's
// established temp-diagnostic-route convention) since the caller here is
// pulling bytes from Google Drive, not a browser file picker.
export async function POST(req: NextRequest) {
  try {
    const { receiptId, files } = await req.json() as {
      receiptId: number
      files: { base64: string; filename: string; mimeType: string }[]
    }
    if (!receiptId || !files?.length) {
      return NextResponse.json({ error: 'Missing receiptId or files' }, { status: 400 })
    }

    const [receipt] = await sql`SELECT id, receipt_number, attachments FROM sales_receipts WHERE id = ${receiptId}`
    if (!receipt) return NextResponse.json({ error: 'Receipt not found' }, { status: 404 })

    const existing: Attachment[] = Array.isArray(receipt.attachments) ? receipt.attachments : []
    const existingNames = new Set(existing.map(a => a.name))

    const uploaded: Attachment[] = []
    for (const f of files) {
      if (existingNames.has(f.filename)) continue // already attached in an earlier partial batch
      const buffer = Buffer.from(f.base64, 'base64')
      const blob = await put(`sales/drive-import-${receiptId}-${Date.now()}-${uploaded.length}`, buffer, {
        access: 'private', contentType: f.mimeType,
      })
      uploaded.push({ url: `/api/sales/media?p=${encodeURIComponent(blob.pathname)}`, type: f.mimeType, name: f.filename })
    }

    const merged = [...existing, ...uploaded]
    await sql`UPDATE sales_receipts SET attachments = ${JSON.stringify(merged)}::jsonb WHERE id = ${receiptId}`

    return NextResponse.json({ ok: true, receiptId, receiptNumber: receipt.receipt_number, uploadedCount: uploaded.length, totalAttachments: merged.length })
  } catch (e) {
    console.error('tmp-attach-receipt error:', e)
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 })
  }
}
