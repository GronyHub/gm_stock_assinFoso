'use client'
import { CH_PERSON_VIEW } from '../_components/chViewData'
import { type LossView } from './hubShared'
import type { HubCtx } from './useHubState'

export default function HubGlobalSearchResults({ h }: { h: HubCtx }) {
  const { setLossView, search, jumpToLiveSaleTab, globalSearchQuery, globalSearchLoading, globalSearchResults, setCustomerSearchText, setVendorSearchText, ch, closeGlobalSearch, changeTab, openPersonSubmenu, canSeeUK, canSeeCH, navMatches, openEditGridItem } = h
  return (<><div className="flex-1 overflow-y-auto">
              {navMatches.length > 0 && (
                <div>
                  <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Go to</p>
                  {navMatches.map(d => (
                    <button key={d.label} onClick={() => { d.action(); closeGlobalSearch() }}
                      className="w-full text-left px-3 py-2 text-sm font-semibold text-blue-600 hover:bg-blue-50 transition truncate">
                      {d.label}
                    </button>
                  ))}
                </div>
              )}
              {globalSearchLoading && <p className="p-4 text-center text-xs text-gray-400">Searching…</p>}
              {!globalSearchLoading && navMatches.length === 0 && globalSearchQuery.trim().length > 0 && globalSearchQuery.trim().length < 2 && (
                <p className="p-4 text-center text-xs text-gray-400">Keep typing…</p>
              )}
              {!globalSearchLoading && globalSearchResults && (() => {
                const r = globalSearchResults
                const totalCount = (r.items?.length ?? 0) + (r.customers?.length ?? 0) + (r.vendors?.length ?? 0)
                  + (r.sales?.length ?? 0) + (r.bills?.length ?? 0) + (r.announcements?.length ?? 0)
                  + (r.ukSubmenus?.length ?? 0) + (r.ukEntries?.length ?? 0) + (r.chLogs?.length ?? 0)
                if (totalCount === 0 && navMatches.length === 0) return <p className="p-4 text-center text-xs text-gray-400">No matches</p>
                return (<>
                  {!!r.items?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Items</p>
                      {r.items.map(i => (
                        <button key={i.id} onClick={() => { openEditGridItem(i.id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {i.name}
                          {i.cf_group && <span className="text-gray-400 text-xs ml-1.5">· {i.cf_group}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.customers?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Customers</p>
                      {r.customers.map(c => (
                        <button key={c.id}
                          onClick={() => { changeTab('loss'); setLossView('customers'); setCustomerSearchText(c.display_name); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {c.display_name}
                          {c.company_name && <span className="text-gray-400 text-xs ml-1.5">· {c.company_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.vendors?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Vendors</p>
                      {r.vendors.map(v => (
                        <button key={v.id}
                          onClick={() => { changeTab('loss'); setLossView('vendors'); setVendorSearchText(v.display_name); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {v.display_name}
                          {v.company_name && <span className="text-gray-400 text-xs ml-1.5">· {v.company_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.sales?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Sales</p>
                      {r.sales.map(s => (
                        <button key={s.id}
                          onClick={() => { changeTab('loss'); jumpToLiveSaleTab('sales', null, s.receipt_number || s.customer_name || ''); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.receipt_number || `Receipt #${s.id}`}
                          {s.customer_name && <span className="text-gray-400 text-xs ml-1.5">· {s.customer_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.bills?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Bills</p>
                      {r.bills.map(b => (
                        <button key={b.id}
                          onClick={() => { changeTab('loss'); jumpToLiveSaleTab('bills', null, b.bill_number || b.vendor_name || ''); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {b.bill_number || `Bill #${b.id}`}
                          {b.vendor_name && <span className="text-gray-400 text-xs ml-1.5">· {b.vendor_name}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.announcements?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">Announcements</p>
                      {r.announcements.map(a => (
                        <button key={a.id} onClick={() => { changeTab('today'); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {a.body || '(no text)'}
                          <span className="text-gray-400 text-xs ml-1.5">· {a.author}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {/* UK/C&H only ever arrive here for accounts the API route
                      itself decided can see them -- see /api/search's
                      canSeeUK/canSeeCH gating. Fiifi/Kuukua/Ebo/Odoye's own
                      rows come back tagged with the same plain `person`
                      string as everyone else's (they're the same
                      uk_submenus/uk_rows tables, see chViewData.ts's
                      CH_PERSON_VIEW) -- split out here so they list (and
                      open) under C&H instead of UK, matching where they
                      actually live now. */}
                  {!!r.ukSubmenus?.filter(s => !(s.person in CH_PERSON_VIEW)).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">UK</p>
                      {r.ukSubmenus.filter(s => !(s.person in CH_PERSON_VIEW)).map(s => (
                        <button key={s.id}
                          onClick={() => { openPersonSubmenu(s.person, s.id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.name}
                          <span className="text-gray-400 text-xs ml-1.5">· {s.person}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukEntries?.filter(e => !(e.person in CH_PERSON_VIEW)).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">UK entries</p>
                      {r.ukEntries.filter(e => !(e.person in CH_PERSON_VIEW)).map(e => (
                        <button key={`${e.row_id}-${e.column_name}`}
                          onClick={() => { openPersonSubmenu(e.person, e.submenu_id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {e.value}
                          <span className="text-gray-400 text-xs ml-1.5">· {e.submenu_name} · {e.column_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukSubmenus?.filter(s => s.person in CH_PERSON_VIEW).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H</p>
                      {r.ukSubmenus.filter(s => s.person in CH_PERSON_VIEW).map(s => (
                        <button key={s.id}
                          onClick={() => { openPersonSubmenu(s.person, s.id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {s.name}
                          <span className="text-gray-400 text-xs ml-1.5">· {s.person}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.ukEntries?.filter(e => e.person in CH_PERSON_VIEW).length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H entries</p>
                      {r.ukEntries.filter(e => e.person in CH_PERSON_VIEW).map(e => (
                        <button key={`${e.row_id}-${e.column_name}`}
                          onClick={() => { openPersonSubmenu(e.person, e.submenu_id); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {e.value}
                          <span className="text-gray-400 text-xs ml-1.5">· {e.submenu_name} · {e.column_name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {!!r.chLogs?.length && (
                    <div>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-bold text-gray-400 uppercase tracking-wide">C&amp;H</p>
                      {r.chLogs.map(l => (
                        <button key={l.id}
                          onClick={() => { changeTab('ch'); setLossView(l.category as LossView); closeGlobalSearch() }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 transition truncate">
                          {l.notes}
                          <span className="text-gray-400 text-xs ml-1.5">· {l.category_label} · {l.log_date}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </>)
              })()}
            </div></>)
}
