// Ghana/this app's own clock is GMT year-round (see /api/sales/live-tap's
// own "Ghana is UTC+0" comment) -- an absolute clock time only means the
// same thing to everyone reading it if it's read off the UTC parts of the
// timestamp rather than whatever timezone the viewer's own device happens
// to be set to. Shared by TodayContent.tsx's feed and StaffTimeDetailModal.
export function fmtClockTime(iso: string): string {
  const d = new Date(iso)
  let h = d.getUTCHours()
  const m = d.getUTCMinutes()
  const ap = h >= 12 ? 'pm' : 'am'
  h = h % 12
  if (h === 0) h = 12
  return `${h}:${String(m).padStart(2, '0')}${ap}`
}
