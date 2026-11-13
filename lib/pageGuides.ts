import sql from '@/lib/db'
import { once } from '@/lib/once'

// Intro ("how to use this page") videos: one per page. Each page has a built-in narrated guide in
// public/guides/<key>.mp4; an owner-level user can replace it with their own screen recording (stored on the
// server's disk, see /api/page-guides/upload) or go back to the built-in one. page_guide_seen remembers, per staff
// member, which guides they've already watched or skipped, so the first-visit notice shows once per page.
export const PAGE_GUIDES: Record<string, string> = {
  sale: 'Live',
  log: 'Sales Log',
  bills: 'Bills',
  expenses: 'Expenses',
  purchase_orders: 'Purchase Orders',
  vendors: 'Vendors',
  customers: 'Customers',
  counts: 'Counts',
  item360: 'Item 360',
  pl: 'P&L',
  cab: 'CAB (Cash at Bank)',
}

export const ensurePageGuideTables = once(async () => {
  await sql`CREATE TABLE IF NOT EXISTS page_guides (
    page_key TEXT PRIMARY KEY, video_path TEXT NOT NULL, uploaded_by TEXT, uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now())`.catch(() => {})
  await sql`CREATE TABLE IF NOT EXISTS page_guide_seen (
    username TEXT NOT NULL, page_key TEXT NOT NULL, seen_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY (username, page_key))`.catch(() => {})
})
