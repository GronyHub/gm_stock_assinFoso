'use client'
import dynamic from 'next/dynamic'
import { STAFF_TEAM_ITEMS, type StaffView } from './staffViewData'
import SavedFlash from './SavedFlash'

const ViewPortalAsButton = dynamic(() => import('@/components/ViewPortalAsButton'), { ssr: false })

// Everything only Joe/Grony can do, in one place -- previously these sat
// inline in the pane at all times (Viewing picker, Team, Users, Add
// Category, View Portal As), making an owner's own day-to-day pane
// noticeably longer than everyone else's. Reached via a single "Settings"
// row instead, so the default pane looks the same for everyone regardless
// of role, and this stuff is a deliberate detour rather than always-visible
// clutter. Viewing moved in too -- it's an occasional context switch, not
// something used routinely enough to justify staying inline.
type Props = {
  onClose: () => void
  viewingName: string
  myStaffName: string | undefined
  staffRoster: string[]
  pickViewing: (name: string) => void
  pickLossView: (view: StaffView) => void
  dynamicCategories: { id: number; label: string }[]
  showAddCategory: boolean
  setShowAddCategory: (show: boolean) => void
  newCategoryLabel: string
  setNewCategoryLabel: (v: string) => void
  savingCategory: boolean
  justAddedCategory: boolean
  addCategory: (e: React.FormEvent) => void
}

const sectionLabelCls = 'text-[11px] font-bold text-gray-400 uppercase tracking-wide mb-1.5'
const chipCls = (active: boolean) =>
  `text-xs font-semibold px-3 py-1.5 rounded-lg transition ${active ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`
const rowCls = 'w-full flex items-center gap-2 text-sm font-semibold text-gray-800 bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2.5 transition text-left'

export default function SettingsPanel({
  onClose, viewingName, myStaffName, staffRoster, pickViewing, pickLossView,
  dynamicCategories, showAddCategory, setShowAddCategory, newCategoryLabel, setNewCategoryLabel,
  savingCategory, justAddedCategory, addCategory,
}: Props) {
  function goAndClose(view: StaffView) {
    pickLossView(view)
    onClose()
  }

  return (
    <div className="flex flex-col h-full min-h-0 bg-white">
      <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-b border-gray-100">
        <p className="font-bold text-gray-900 text-base">⚙️ Settings</p>
        <button onClick={onClose}
          className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
          Close
        </button>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-5">
        {myStaffName && (
          <div>
            <p className={sectionLabelCls}>Viewing</p>
            <div className="flex flex-wrap gap-1.5">
              <button onClick={() => pickViewing(myStaffName)} className={chipCls(viewingName === myStaffName)}>Me</button>
              {staffRoster.filter(n => n.toLowerCase() !== myStaffName.toLowerCase()).map(name => (
                <button key={name} onClick={() => pickViewing(name)} className={chipCls(viewingName === name)}>{name}</button>
              ))}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5">Changes whose Payslips/Violations/Ana/Assignments show in Staff -- Times stays the shared team view.</p>
          </div>
        )}

        <div className="space-y-1.5">
          <p className={sectionLabelCls}>Team</p>
          {STAFF_TEAM_ITEMS.map(t => (
            <button key={t.key} onClick={() => goAndClose(t.key)} className={rowCls}>
              <span>{t.icon}</span><span>{t.label}</span>
            </button>
          ))}
        </div>

        <div>
          <p className={sectionLabelCls}>Access</p>
          <button onClick={() => goAndClose('users')} className={rowCls}>
            <span>🔑</span><span>Users</span>
          </button>
        </div>

        <div>
          <p className={sectionLabelCls}>Manage Categories</p>
          {dynamicCategories.length > 0 && (
            <ul className="text-xs text-gray-500 mb-1.5 space-y-0.5">
              {dynamicCategories.map(c => <li key={c.id}>🗂️ {c.label}</li>)}
            </ul>
          )}
          {showAddCategory ? (
            <form onSubmit={addCategory} className="space-y-1.5">
              <input autoFocus value={newCategoryLabel} onChange={e => setNewCategoryLabel(e.target.value)}
                placeholder="Name *"
                className="w-full text-sm bg-gray-50 border border-gray-300 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-blue-400" />
              <div className="flex items-center gap-1.5">
                <button type="submit" disabled={savingCategory || !newCategoryLabel.trim()}
                  className="flex-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40 transition">
                  {savingCategory ? '…' : 'Add'}
                </button>
                <button type="button" onClick={() => { setShowAddCategory(false); setNewCategoryLabel('') }}
                  className="text-xs font-semibold px-2.5 py-1.5 rounded-lg bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                  ✕
                </button>
              </div>
            </form>
          ) : (
            <button onClick={() => setShowAddCategory(true)} className={rowCls}>
              <span>➕</span><span>Add Category</span>
            </button>
          )}
          {justAddedCategory && <p className="pt-1"><SavedFlash show /></p>}
          <p className="text-[11px] text-gray-400 mt-1.5">Delete an existing category from its row in Manage -- the × there is already owner-only.</p>
        </div>

        <div>
          <p className={sectionLabelCls}>View Portal As</p>
          <ViewPortalAsButton />
        </div>
      </div>
    </div>
  )
}
