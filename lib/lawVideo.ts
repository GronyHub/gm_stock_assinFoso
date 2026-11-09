// What a tile's single video covers, second by second: the chapters (the narration, as a transcript) and which laws the video
// speaks to. Staff tap any line to jump to that moment. The chapters file is written by the recorder
// (docs/guides/real/record.js) from the real narration, so the times always match the video.
import items from './videoChapters/items.json'
import { parseViolations } from './lawViolations'

export type Chapter = { t: number; title: string; text: string; lawRe?: string }
export type AreaVideo = { chapters: Chapter[] }

// The chapter whose title or narration matches a pattern: how a how-to topic or a flag is tied to its moment in the video.
export const findChapter = (v: AreaVideo, re: string): Chapter | null => v.chapters.find(c => new RegExp(re, 'i').test(c.title + ' ' + c.text)) ?? null

export const AREA_VIDEO: Record<string, AreaVideo> = {
  items: items as AreaVideo,
}

export const fmtTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t) % 60).padStart(2, '0')}`
// The chapter that reads a law out: the first whose pattern matches the law's text (or its code).
export const lawChapter = (v: AreaVideo, law: { text: string; code?: string | null; violations?: string | null }): Chapter | null => {
  for (const x of parseViolations(law.violations)) { if (x.chapter) { const c = findChapter(v, x.chapter); if (c) return c } }
  return v.chapters.find(c => c.lawRe && (new RegExp(c.lawRe, 'i').test(law.text) || (!!law.code && new RegExp(`\\b${law.code}\\b`).test(c.lawRe)))) ?? null
}
export const lawTime = (v: AreaVideo, law: { text: string; code?: string | null; violations?: string | null }): number | null => lawChapter(v, law)?.t ?? null
