// One permission list for the left sidebar. Every permission-based button in
// app/(protected)/item/_hub/HubSidePane.tsx asks this table whether to show
// itself. Nothing else decides, so to see who gets a button, read its row here.
//
// Adding a button: give it a row below, then use show('yourRow') in HubSidePane.
// Changing who sees it: change only its row. Hiding a button is not security:
// the server must refuse the data too (see proxy.ts).

export type SidebarPerms = {
  isOwnerOrJoe: boolean   // the owner or Joe
  canSeeCash: boolean     // permission 'cash'
  canSeePL: boolean       // permission 'pl'
  showFlags: boolean      // owner, Joe, or a manager
  canSeeCH: boolean       // permission 'ch'
  canSeeCaretake: boolean // permission 'caretaker'
  careLog: boolean        // permission 'care_log'
  isCaretakerOnly: boolean // a childrens-manager account: no Biz, UK or C&H tabs
  canSeeUK: boolean       // permission 'uk' (or Grony)
  canSeeCHTab: boolean    // any Care or C&H permission
  canOpenSettings: boolean
}

export const SIDEBAR_RULES = {
  // Live, Counts, Sales Log, Customers, Item 360, Losses, Analytics, How To
  cashGroup: (p: SidebarPerms) => p.canSeeCash,
  // Flags (its count is the flag total the other rows no longer repeat)
  flags: (p: SidebarPerms) => p.canSeeCash && p.showFlags,
  // Bills, Purchase Orders, Vendors, Expenses, P&L
  moneyGroup: (p: SidebarPerms) => p.canSeeCash && p.isOwnerOrJoe,
  bills: (p: SidebarPerms) => p.canSeeCash && p.isOwnerOrJoe,
  pl: (p: SidebarPerms) => p.canSeeCash && p.canSeePL && p.isOwnerOrJoe,
  // Settings (not shown on the UK tab; that check stays with the tab)
  settings: (p: SidebarPerms) => p.isOwnerOrJoe && p.canOpenSettings,
  // Care (C&H) rows
  chCare: (p: SidebarPerms) => p.canSeeCH || p.canSeeCaretake || p.careLog,
  // The three area tabs at the bottom of the sidebar
  bizTab: (p: SidebarPerms) => !p.isCaretakerOnly && (p.canSeeUK || p.canSeeCHTab),
  ukTab: (p: SidebarPerms) => p.canSeeUK,
  chTab: (p: SidebarPerms) => p.canSeeCHTab,
} as const

export type SidebarRule = keyof typeof SIDEBAR_RULES
