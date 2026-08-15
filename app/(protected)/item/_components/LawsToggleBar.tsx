'use client'
import type { LawFormKind } from './PageLawsList'
import type { LawFilterKey } from './useLawsPanel'

// L/T each merge a "+create" button with their own filter checkbox into
// one compact control -- tapping the "+L"/"+T" label opens the create
// form, the checkbox next to it filters the list to that category. G has no
// matching "+create" button -- group shortcut flags are derived from item
// groups, never user-created -- so it stays its own plain filter checkbox,
// same as 0 (hide zero-count flags).
const CREATE_FILTER_PAIRS: { key: 'L' | 'T'; form: Exclude<LawFormKind, null>; createTitle: string; filterTitle: string }[] = [
  { key: 'L', form: 'law',  createTitle: 'Create new law',     filterTitle: 'Show only laws & flags' },
  { key: 'T', form: 'task', createTitle: 'Create global task', filterTitle: 'Show only tasks' },
]

// The ⚖️ / +L / +T / G / 0 row every inline law panel is toggled and
// filtered by -- same markup Items/Sales/Bills already use inline in
// item/page.tsx, pulled out so new pages don't hand-copy it again. `dark`
// picks the light-icons-on-a-colored-bar look those two use; pass
// `dark={false}` for a plain white/gray header instead.
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
          {/* Multi-select, all combine -- none checked (the default) shows
              everything, same as before these existed. L covers both plain
              laws and real violation flags together (some laws have a
              linked flag, some don't -- they're the same category). */}
          {CREATE_FILTER_PAIRS.map(({ key, form, createTitle, filterTitle }) => (
            <span key={key}
              className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg transition ${openForm === form ? activeCls : idleCls}`}>
              <button onClick={() => setOpenForm(openForm === form ? null : form)} title={createTitle}
                className="text-xs font-semibold leading-none">
                +{key}
              </button>
              <input type="checkbox" checked={activeFilters.has(key)} onChange={() => toggleFilter(key)} title={filterTitle}
                className="w-4 h-4 rounded border-gray-300" />
            </span>
          ))}
          <label className={`shrink-0 flex items-center gap-1 px-1.5 py-1 rounded-lg cursor-pointer transition ${idleCls}`}
            title="Group shortcuts">
            <input type="checkbox" checked={activeFilters.has('G')} onChange={() => toggleFilter('G')}
              className="w-4 h-4 rounded border-gray-300" />
            <span className="text-xs font-semibold leading-none">G</span>
          </label>
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
