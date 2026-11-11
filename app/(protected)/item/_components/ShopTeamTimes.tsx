'use client'
import { TimesTab } from '../../staff/StaffClient'

// The Shop's "Times" tab: the whole team's clock-ins and time entries (what the sidebar's Team Times used to open).
export default function ShopTeamTimes({ username, role }: { username: string; role: string }) {
  return <TimesTab username={username} role={role} />
}
