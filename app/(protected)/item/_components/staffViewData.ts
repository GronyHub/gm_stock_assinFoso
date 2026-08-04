// Staff's left-pane row data, split out from StaffPersonTab.tsx so
// item/page.tsx can build the merged Grony Cash pane without importing (and
// bundling) StaffContent's actual tab components just to know these labels.
// Assignments (who's responsible for which recurring violation type) used
// to be its own personal/team tab here -- moved to a small AssignWidget on
// each violation type's own home page (Sales, Items, CAB, Staff Times)
// instead, plus a personalized summary in Tasks (see TasksView.tsx).
export type StaffView =
  | 'staffPayslips' | 'staffProfile'
  | 'teamTimes' | 'team_payments' | 'allStaff' | 'team_behaviour' | 'users' | 'roles'
  | 'staff_meeting' | 'staff_display' | 'rota' | 'assessment' | 'tutorial' | 'training_laws' | 'logs' | 'staff_dress'
  | 'teamPayslips' | 'teamProfiles'

// Times/Violations/Ana used to live here too -- dropped so Personal is just
// each staff member's own pay record (Profile is a separate always-shown
// row, not part of this list -- see item/page.tsx's pane). Times moved to
// Team Times (it already covers "my own" as a special case of "everyone"),
// Violations to Team Penalty Points, and Ana had no team equivalent so it's
// just gone -- there was no write action tied to any of the three, only
// Times' embedded clock-in button, which Team Times still provides.
export const STAFF_PERSONAL_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'staffPayslips', label: 'Payslips', icon: '💵' },
]

// "All Staff" is now just Disciplinary content (Payslips/Times moved out to
// Staff Payments and the Times tab's flag page, respectively), so its label
// reflects what it actually shows.
//
// Team Rota/Team Dress Code/Team Display/Team Meeting/Team Tutorial/Team
// Company Laws Agreement/Team Assessment/Team Logs used to sit in Manage's
// own section -- moved here since they're all about staff/the team as a
// whole rather than shop operations, so they now live behind the same
// canSeeTeam gate as the rest of this list instead of Manage's canSeeManage.
//
// Team Payslips/Team Profiles are NOT in this list -- see
// STAFF_ADMIN_TEAM_ITEMS below. Everything here is visible to anyone
// granted the general Team permission (e.g. Bino/James); those two carry
// pay amounts and personal bio/bank details for the whole staff, so they're
// restricted to owner-level (Grony/Joe) only and tucked into Settings
// instead of sitting in this shared section.
//
// Every row's label carries "Team" now, and Tutorial/Company Laws/
// Assessment lost their separate "Training" sub-header -- this whole
// section is about staff as a group, not one person, so there's no reason
// for three of its twelve rows to read as a breakaway sub-topic instead of
// just three more Team pages. No `group` tag left on anything here means
// STAFF_TEAM_ITEMS renders as one flat, fully-dividered list (see
// item/page.tsx's Team section) -- unlike Manage, which still splits Advert
// and Grony 1 to 10 checks out (see MANAGE_GROUP_LABELS/buildPaneRuns in
// paneOrder.ts), this section merges back into one.
export const STAFF_TEAM_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'teamTimes', label: 'Team Times', icon: '🕐' },
  { key: 'team_payments', label: 'Team Payments', icon: '💳' },
  { key: 'allStaff', label: 'Team Penalty Points', icon: '🏢' },
  { key: 'team_behaviour', label: 'Team Behaviour', icon: '🚦' },
  { key: 'staff_dress', label: 'Team Dress Code', icon: '👕' },
  { key: 'staff_display', label: 'Team Display', icon: '📌' },
  { key: 'staff_meeting', label: 'Team Meeting', icon: '🗣️' },
  { key: 'tutorial', label: 'Team Tutorial', icon: '📖' },
  { key: 'training_laws', label: 'Team Company Laws Agreement', icon: '⚖️' },
  { key: 'assessment', label: 'Team Assessment', icon: '📝' },
  { key: 'rota', label: 'Team Rota', icon: '🗓️' },
  { key: 'logs', label: 'Team Logs', icon: '📜' },
]

// Owner-level-only Team rows -- rendered from Settings (see SettingsPane.tsx)
// instead of the main pane's Team section, gated by canManage rather than
// canSeeTeam so granting someone the general Team permission (Bino/James)
// doesn't also hand them every staff member's pay/bank details.
export const STAFF_ADMIN_TEAM_ITEMS: { key: StaffView; label: string; icon: string }[] = [
  { key: 'teamPayslips', label: 'Team Payslips', icon: '💵' },
  { key: 'teamProfiles', label: 'Team Profiles', icon: '🪪' },
]
