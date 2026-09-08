'use client'
import StaffMemberPersonalTab from './StaffMemberPersonalTab'

type StaffMemberModalProps = {
  username: string
  role: string
  canManage: boolean
  staffRoster: string[]
  routablePages: string[]
  categoryIds: Record<string, number>
}

// Full personal page for one staff member, opened as a modal over whatever's
// currently showing rather than navigating away from it -- opened by tapping
// a name in PresentStaffBar, landing straight on the Times tab (see
// StaffMemberPersonalTab's own initialTab) since that's what someone tapping
// a worked-hours chip is actually looking for. Same
// Tasks/Mentions/Dress Code/Behaviour/Assessment/Meeting/Display/Laws tabs
// as the full-page version reached from the pane's own "Staff Members" row
// -- this is that exact component, just in an overlay instead of a lossView.
export type { StaffMemberModalProps }
export default function StaffMemberModal({
  staffName, onClose, ...rest
}: StaffMemberModalProps & { staffName: string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[200] bg-black/50 flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 shrink-0">
          <p className="text-sm font-bold text-gray-900 capitalize">{staffName}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
        </div>
        <div className="flex-1 overflow-y-auto">
          <StaffMemberPersonalTab staffName={staffName} initialTab="times" {...rest} />
        </div>
      </div>
    </div>
  )
}
