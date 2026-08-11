'use client'
import type { LawFormKind } from './PageLawsList'
import type { LawFilterKey } from './useLawsPanel'

const FILTER_LABELS: { key: LawFilterKey; title: string }[] = [
  { key: 'L', title: 'Laws & flags' },
  { key: 'G', title: 'Group shortcuts' },
  { key: 'T', title: 'Tasks' },
  { key: 'N', title: 'Notes' },
]

// The ⚖️ / + Law / + Task / + Note / L-G-T-N / 0 row every inline law
// panel is toggled and filtered by -- same markup Items/Sales/Bills
// already use inline in item/page.tsx, pulled out so new pages don't
// hand-copy it again. `dark` picks the light-icons-on-a-colored-bar look
// those three use; pass `dark={false}` for a plain white/gray header
// instead.
export default function LawsToggleBar({
  show, setShow, openForm, setOpenForm, hideZeroFlags, setHideZeroFlags,
  activeFilters, toggleFilter, dark = true,
}: {
  show: boolean
  setShow: (v: boolean | ((prev: boolean) => boolean)) => void
  openForm: LawFormKind
  setOpenForm: (v: LawFormKind) => void
  hideZeroFlags: boolean
  setHideZeroFlags: (v: boolean | ((prev: boolean) => boolean)) => void
  activeFilters: Set<LawFilterKey>
  toggleFilter: (key: LawFilterKey) => void
  dark?: boolean
}) {
  const activeCls = dark ? 'bg-white text-green-800' : 'bg-gray-200 text-gray-800'
  const idleCls = dark ? 'text-white hover:bg-white/10' : 'text-gray-500 hover:bg-gray-100'

  return (
    <>
      <button onClick={() => setShow(o => !o)} title="Show laws on this page"
        className={`shrink-0 text-sm leading-none px-1.5 py-1 rounded-lg transition ${show ? activeCls : idleCls}`}>
        ⚖️
      </button>
      {show && (
        <>
          <button onClick={() => setOpenForm(openForm === 'law' ? null : 'law')} title="Create new law"
            className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${openForm === 'law' ? activeCls : idleCls}`}>
            + Law
          </button>
          <button onClick={() => setOpenForm(openForm === 'task' ? null : 'task')} title="Create global task"
            className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${openForm === 'task' ? activeCls : idleCls}`}>
            + Task
          </button>
          <button onClick={() => setOpenForm(openForm === 'note' ? null : 'note')} title="Create global note"
            className={`shrink-0 text-xs font-semibold leading-none px-2 py-1 rounded-lg transition ${openForm === 'note' ? activeCls : idleCls}`}>
            + Note
          </button>
          {/* Row-category filters -- multi-select, all combine. None
              checked (the default) shows everything, same as before these
              existed. L covers both plain laws and real violation flags
              together (some laws have a linked flag, some don't -- they're
              the same category); G is just the per-group shortcut flags,
              kept separate since they're not laws or violations. */}
          {FILTER_LABELS.map(({ key, title }) => (
            <label key={key} title={title}
              className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg cursor-pointer transition ${idleCls}`}>
              <input type="checkbox" checked={activeFilters.has(key)} onChange={() => toggleFilter(key)}
                className="w-4 h-4 rounded border-gray-300" />
              <span className="text-xs font-semibold leading-none">{key}</span>
            </label>
          ))}
          <label className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg cursor-pointer transition ${idleCls}`}
            title="Hide 0-count flags">
            <input type="checkbox" checked={hideZeroFlags} onChange={e => setHideZeroFlags(e.target.checked)}
              className="w-4 h-4 rounded border-gray-300" />
            <span className="text-xs font-semibold leading-none">0</span>
          </label>
        </>
      )}
    </>
  )
}
