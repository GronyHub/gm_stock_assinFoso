// Staff's left-pane row data, split out from StaffPersonTab.tsx so
// item/page.tsx can build the merged Grony Cash pane without importing (and
// bundling) StaffContent's actual tab components just to know these labels.
// Assignments (who's responsible for which recurring violation type) used
// to be its own personal/team tab here -- moved to a small AssignWidget on
// each violation type's own home page (Sales, Items, CAB, Staff Times)
// instead, plus a personalized summary in Tasks (see TasksView.tsx).
export type StaffView =
  | 'staffTimes' | 'staffPayslips' | 'staffViolations' | 'staffAnalytics' | 'staffProfile'
  | 'teamPayslips' | 'teamProfiles' | 'allStaff' | 'users' | 'roles'
  | 'staff_meeting' | 'staff_display' | 'rota' | 'assessment' | 'tutorial' | 'training_laws' | 'logs' | 'staff_dress'

export const STAFF_PERSONAL_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'staffTimes', label: 'Times', icon: '🕐' },
  { key: 'staffPayslips', label: 'Payslips', icon: '💵' },
  { key: 'staffViolations', label: 'Violations', icon: '⚠️' },
  { key: 'staffAnalytics', label: 'Ana', icon: '📊' },
]

// Team Profiles used to be one of Team Payslips' own views ("🪪 Profiles")
// -- pulled out since staff bio/bank details have nothing to do with pay
// records specifically. "All Staff" is now just Disciplinary content
// (Payslips/Times moved out to Staff Payments and the Times tab's flag
// page, respectively), so its label reflects what it actually shows.
//
// Rota/Dress Code/Staff Display/Staff Meeting/Tutorial/Company Laws/
// Assessment/Logs used to sit in Manage's own section -- moved here since
// they're all about staff/the team as a whole rather than shop operations,
// so they now live behind the same canSeeTeam gate as the rest of this
// list instead of Manage's canSeeManage.
export const STAFF_TEAM_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'teamPayslips', label: 'Team Payslips', icon: '💵' },
  { key: 'teamProfiles', label: 'Team Profiles', icon: '🪪' },
  { key: 'allStaff', label: 'Team Penalty Points', icon: '🏢' },
  { key: 'staff_dress', label: 'Dress Code', icon: '👕' },
  { key: 'staff_display', label: 'Staff Display', icon: '📌' },
  { key: 'staff_meeting', label: 'Staff Meeting', icon: '🗣️' },
  { key: 'tutorial', label: 'Tutorial', icon: '📖' },
  { key: 'training_laws', label: 'Company Laws', icon: '⚖️' },
  { key: 'assessment', label: 'Assessment', icon: '📝' },
  { key: 'rota', label: 'Rota', icon: '🗓️' },
  { key: 'logs', label: 'Logs', icon: '📜' },
]
