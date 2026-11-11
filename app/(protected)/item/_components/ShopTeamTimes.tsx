'use client'
import { TimesTab } from '../../staff/StaffClient'

// The Shop's "Times" tab: the whole team's clock-ins and time entries (read only: staff clock in and out from the Times tab on their own profile).
export default function ShopTeamTimes({ username, role }: { username: string; role: string }) {
  return <TimesTab username={username} role={role} readOnly />
}
