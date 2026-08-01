// Staff's left-pane row data, split out from StaffPersonTab.tsx so
// item/page.tsx can build the merged Grony Cash pane without importing (and
// bundling) StaffContent's actual tab components just to know these labels.
export type StaffView =
  | 'staffTimes' | 'staffPayslips' | 'staffViolations' | 'staffAnalytics' | 'staffAssignments' | 'staffProfile'
  | 'teamPayslips' | 'teamProfiles' | 'allStaff' | 'users' | 'roles'

export const STAFF_PERSONAL_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'staffTimes', label: 'Times', icon: '🕐' },
  { key: 'staffPayslips', label: 'Payslips', icon: '💵' },
  { key: 'staffViolations', label: 'Violations', icon: '⚠️' },
  { key: 'staffAnalytics', label: 'Ana', icon: '📊' },
  { key: 'staffAssignments', label: 'Assignments', icon: '📋' },
]

// Rota isn't repeated here -- it's the same RotaTab already listed once
// under Manage's own section of the merged pane. Team Profiles used to be
// one of Team Payslips' own views ("🪪 Profiles") -- pulled out since staff
// bio/bank details have nothing to do with pay records specifically.
// "All Staff" is now just Disciplinary content (Payslips/Times moved out
// to Staff Payments and the Times tab's flag page, respectively), so its
// label reflects what it actually shows.
export const STAFF_TEAM_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'teamPayslips', label: 'Team Payslips', icon: '💵' },
  { key: 'teamProfiles', label: 'Team Profiles', icon: '🪪' },
  { key: 'allStaff', label: 'Team Penalty Points', icon: '🏢' },
]
