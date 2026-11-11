'use client'
import { RotaTab } from '../../staff/StaffClient'

// The Shop's "Rota" tab: the team's rota. Creating it here names the Opener and Closer of each day, which To do and the penalties then use.
export default function ShopRota({ canManage }: { canManage: boolean }) {
  return <RotaTab canManage={canManage} />
}
