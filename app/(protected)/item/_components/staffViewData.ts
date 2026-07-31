// Staff's left-pane row data, split out from StaffPersonTab.tsx so
// item/page.tsx can build the merged Grony Cash pane without importing (and
// bundling) StaffContent's actual tab components just to know these labels.
export type StaffView =
  | 'staffTimes' | 'staffPayslips' | 'staffViolations' | 'staffAnalytics' | 'staffAssignments' | 'staffProfile'
  | 'teamPayslips' | 'allStaff' | 'users'

export const STAFF_PERSONAL_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'staffTimes', label: 'Times', icon: '🕐' },
  { key: 'staffPayslips', label: 'Payslips', icon: '💵' },
  { key: 'staffViolations', label: 'Violations', icon: '⚠️' },
  { key: 'staffAnalytics', label: 'Ana', icon: '📊' },
  { key: 'staffAssignments', label: 'Assignments', icon: '📋' },
]

// Rota isn't repeated here -- it's the same RotaTab already listed once
// under Manage's own section of the merged pane.
export const STAFF_TEAM_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'teamPayslips', label: 'Team Payslips', icon: '💵' },
  { key: 'allStaff', label: 'All Staff', icon: '🏢' },
]
