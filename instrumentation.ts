// Keeps the two expensive, server-cached endpoints warm so the first person
// to open the app after a cache expiry or a deploy doesn't wait for them
// (/api/flags ~3-5 s, /api/losses/summary ~2 s on a cold cache).
//
// A call while the cache is still fresh costs no database work, so polling
// every 10 minutes only does real work right after an expiry. Limited to
// shop hours (Mon-Sat, 06:00-19:00 UTC; Ghana is GMT) so it never keeps
// Neon's compute awake overnight or on Sundays -- see AGENTS.md on Neon cost.
const INTERVAL_MS = 10 * 60 * 1000
const FIRST_DELAY_MS = 30 * 1000

function inShopHours(d = new Date()) {
  const day = d.getUTCDay()
  const h = d.getUTCHours()
  return day >= 1 && day <= 6 && h >= 6 && h < 19
}

async function warm() {
  if (!inShopHours()) return
  const base = `http://127.0.0.1:${process.env.PORT || 3000}`
  const secret = process.env.MAINTENANCE_SECRET
  const calls: Promise<unknown>[] = [fetch(`${base}/api/flags`)]
  if (secret) calls.push(fetch(`${base}/api/losses/summary`, { headers: { authorization: `Bearer ${secret}` } }))
  await Promise.allSettled(calls)
}

export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs') return
  if (process.env.NEXT_PHASE === 'phase-production-build') return
  if (process.env.NODE_ENV !== 'production') return
  setTimeout(() => {
    void warm()
    setInterval(() => void warm(), INTERVAL_MS).unref()
  }, FIRST_DELAY_MS).unref()

  // Caretaker reminders / missed-item alerts. Ticks every minute but only
  // touches the database at the minutes listed in lib/careAlerts.ts.
  // Turn off with CARETAKER_ALERTS=off.
  setInterval(() => {
    void import('./lib/careAlerts').then(m => m.careAlertsTick()).catch(e => console.error('careAlerts tick failed:', e instanceof Error ? e.message : String(e)))
  }, 60000).unref()

  // Customer-service reminders at 08:30, 11:00, 14:30 and 17:30 (Mon-Sat). Turn off with SERVICE_REMINDERS=off.
  setInterval(() => {
    void import('./lib/serviceReminders').then(m => m.serviceRemindersTick()).catch(e => console.error('serviceReminders tick failed:', e instanceof Error ? e.message : String(e)))
  }, 60000).unref()

  // Daily Checklist alerts (due now, late, owner alert, end-of-day summary). Turn off with CHECKLIST_ALERTS=off.
  setInterval(() => {
    void import('./lib/checklistAlerts').then(m => m.checklistAlertsTick()).catch(e => console.error('checklistAlerts tick failed:', e instanceof Error ? e.message : String(e)))
  }, 60000).unref()

  // Penalty points: Monday prompt, day-end missed-task points (19:20), clean-week fading (19:30). Turn off with PENALTIES=off.
  setInterval(() => {
    void import('./lib/penalties').then(m => m.penaltiesTick()).catch(e => console.error('penalties tick failed:', e instanceof Error ? e.message : String(e)))
  }, 60000).unref()

  // Attendance: the 7pm "are you still at the shop?" push, the CCTV-review detection (19:40 and 07:00), and reminders to approve (2-hourly). Turn off with ATTENDANCE=off.
  setInterval(() => {
    void import('./lib/attendance').then(m => m.attendanceTick()).catch(e => console.error('attendance tick failed:', e instanceof Error ? e.message : String(e)))
  }, 60000).unref()
}
