'use client'
import { Fragment } from 'react'
import ClockInGateModal from '../_components/ClockInGateModal'
import GmcOverageGateModal from '../_components/GmcOverageGateModal'
import type { Attachment } from '../_components/attachmentsShared'
import VoiceSale from '@/components/VoiceSale'
import GlobalMic from '@/components/GlobalMic'
import ScanButton from '@/components/ScanButton'
import { fillSearchBox } from '@/lib/voiceCommands'
import PageToolbar from '@/lib/pageToolbar'
import PageGuide from '@/components/PageGuide'
import { ColumnsPickerButton } from '../_components/columnPrefs'
import { GRONY_CHECKS_ITEMS, ADVERT_ITEMS, type ManageView } from '../_components/manageViewData'
import { STAFF_TEAM_ITEMS, type StaffView } from '../_components/staffViewData'
import { TabErrorBoundary, ExpenseOrdersPanel, ExpensesTab, NewExpenseForm, ExpensesAnalyticsSection, GronyManageContent, VendorsPage, StaffContent, SalesDaysSection, BillsTab, NewBillForm, POTab, BillsAnalyticsSection, STAFF_ROSTER, MANAGE_VIEW_KEYS, ITEM_SORT_LABELS, EXPENSES_PROPERTY_TYPES, type Item, type Tap } from './hubShared'
import type { HubCtx } from './useHubState'
import HubLogMode from './HubLogMode'
import HubLiveDebug from './HubLiveDebug'

export default function HubScrollArea({ h }: { h: HubCtx }) {
  const { openShop, outerTab, group, lossView, search, violation, staffTimeSignal, vendorSignal, propertiesInitialTab, jumpToBillId, setJumpToBillId, liveSaleMounted, liveExpanded, setLiveExpanded, liveGroupFilter, liveItemSortOrder, liveSortOrderModalOpen, setLiveSortOrderModalOpen, liveMode, liveManageSection, setLiveManageSection, liveBillsViolationFilter, setLiveSaleView, liveEmbeddedSearch, setLiveEmbeddedSearch, setLiveSaleViolationFilter, sidePaneHidden, fixedCategoryIds, items, globalFlags, openerViolations, assignments, deadlines, assignedBy, assignedOn, vSettings, setExpensesFlagsCount, setVendorsFlagsCount, clockGateOpen, negPrompt, setNegPrompt, gmcOverageGate, gmcPropertyPrompt, setGmcPropertyPrompt, gmcPropertySaving, setGmcPropertySaving, voiceSaleSignal, setVoiceSaleSignal, voiceSaleText, setVoiceSaleText, scanItem, setScanItem, scanSignal, setScanSignal, embedRef, embedUrl, personal, pickLossView, voiceDests, goToViolation, isDesktop, role, username, canManage, canSeeCash, canSeeManage, canSeeTeam, canSeeUsers, myStaffName, viewingName, routablePages, liveTaps, setLiveTaps, liveSaleType, liveEditingTapId, setLiveEditingTapId, liveEditingTapTime, setLiveEditingTapTime, liveEditingTapSaving, liveEditingCountTime, setLiveEditingCountTime, liveEditingFullTapId, setLiveEditingFullTapId, liveEditingCurrentDate, setLiveEditingCurrentDate, liveEditingFullTapForm, setLiveEditingFullTapForm, liveEditingFullTapSaving, liveEditingCountTimeSaving, liveNewEntryOpen, setLiveNewEntryOpen, liveNewEntryForm, setLiveNewEntryForm, liveNewEntrySaving, setLiveNewEntrySaving, liveEditingAddingNewInModal, setLiveEditingAddingNewInModal, liveNewEntryItemSearch, setLiveNewEntryItemSearch, showToast, liveRootClassName, liveEditingCountId, setLiveEditingCountId, liveBillsAddingNew, setLiveBillsAddingNew, liveBillsShowPurchaseOrders, liveBillsShowVendors, liveExpensesAddingNew, setLiveExpensesAddingNew, liveExpensesShowOrders, liveBillsShowAnalytics, setLiveBillsShowAnalytics, liveExpensesShowAnalytics, liveBillsShowHistory, setLiveBillsShowHistory, liveBillsBarsOnly, setLiveBillsBarsOnly, liveBillsVendorFilter, setLiveBillsVendorFilter, liveBillsMonthFilter, setLiveBillsMonthFilter, liveBillsYearFilter, setLiveBillsYearFilter, liveBillsGmcFilter, liveBillsAvailableVendors, setLiveBillsAvailableVendors, liveBillsAvailableYears, setLiveBillsAvailableYears, liveBillsColPrefs, liveExpensesShowHistory, setLiveExpensesShowHistory, liveExpensesActiveFlag, setLiveExpensesActiveFlag, setLiveExpensesFlagCounts, liveExpensesGroupBy, setLiveExpensesGroupBy, liveExpensesShowProperties, setLiveExpensesShowProperties, liveExpensesShowNonProperties, setLiveExpensesShowNonProperties, liveExpensesPropertyAvailabilityFilter, setLiveExpensesPropertyAvailabilityFilter, liveExpensesPropertyTypeFilter, setLiveExpensesPropertyTypeFilter, setLiveExpensesViewCounts, liveExpensesAccountFilter, setLiveExpensesAccountFilter, liveExpensesAccountOptions, setLiveExpensesAccountOptions, liveExpensesShowAccountsManager, setLiveExpensesShowAccountsManager, liveExpensesColumnsOpen, setLiveExpensesColumnsOpen, liveSalesBillsItems, liveBillsRadioValue, selectLiveBillsRadio, selectLiveExpensesRadio, liveExpensesColPrefs, liveExpensesMainRadios, renderLiveExpensesRadio, liveCountIntervalFlags, liveGmcItemIds, moveItemSortKey, liveCatalogueItems, resolveClockGate, resolveOverageGate, saveEditingTapTime, saveEditingFullTap, createNewLogEntry, saveEditingCountTime, goCountMode, renderModeToggleRow, renderExpensesFiltersBar } = h
  return (<>{(outerTab === 'loss' && lossView === 'sales') || (outerTab === 'loss' && lossView === 'items') ? (<>
          {/* Filter bar moved to green header above */}
          {/* Log tab */}
          {<HubLogMode h={h} />}

          {/* Edit tap time modal */}
          {liveEditingTapId != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Tap Time</h3>
                <input
                  type="datetime-local"
                  value={liveEditingTapTime}
                  onChange={e => setLiveEditingTapTime(e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingTapId(null)
                      setLiveEditingTapTime('')
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditingTapTime}
                    disabled={liveEditingTapSaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveEditingTapSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit count time modal */}
          {liveEditingCountId != null && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Count Time</h3>
                <input
                  type="datetime-local"
                  value={liveEditingCountTime}
                  onChange={e => setLiveEditingCountTime(e.target.value)}
                  className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400 mb-4"
                />
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingCountId(null)
                      setLiveEditingCountTime('')
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditingCountTime}
                    disabled={liveEditingCountTimeSaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveEditingCountTimeSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Select tap to edit modal */}
          {liveEditingFullTapId === -1 && liveEditingCurrentDate && !liveEditingAddingNewInModal && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[500px] overflow-y-auto p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-gray-900">Edit Log Entry for {new Date(liveEditingCurrentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
                  <button
                    onClick={() => {
                      setLiveEditingAddingNewInModal(true)
                      setLiveNewEntryForm(f => ({ ...f, tappedAt: `${liveEditingCurrentDate}T${new Date().toTimeString().slice(0, 5)}` }))
                    }}
                    title="Add new entry"
                    className="text-green-600 hover:text-green-800 font-bold text-lg leading-none p-0 border-0 bg-transparent"
                  >
                    +
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-[12px]">
                    <thead>
                      <tr className="bg-gray-100 border-b border-gray-200">
                        <th className="text-left px-2 py-1 font-semibold text-gray-600">Item</th>
                        <th className="text-right px-2 py-1 font-semibold text-gray-600">Price</th>
                        <th className="text-right px-2 py-1 font-semibold text-gray-600">Qty</th>
                        <th className="text-right px-2 py-1 font-semibold text-gray-600">Total</th>
                        <th className="text-center px-2 py-1 font-semibold text-gray-600">Type</th>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600">Staff</th>
                        <th className="text-left px-2 py-1 font-semibold text-gray-600">Time</th>
                      </tr>
                    </thead>
                    <tbody>
                      {liveTaps.filter((t): t is Tap => t != null && !t.undone && t.tapped_at.startsWith(liveEditingCurrentDate)).map(tap => (
                        <tr
                          key={tap.id}
                          onClick={() => {
                            setLiveEditingFullTapId(tap.id)
                            setLiveEditingFullTapForm({
                              quantity: String(tap.quantity || ''),
                              customPrice: String(tap.price || ''),
                              tappedAt: tap.tapped_at.slice(0, 16)
                            })
                          }}
                          className="border-b border-gray-100 hover:bg-blue-50 cursor-pointer transition"
                        >
                          <td className="px-2 py-1.5 text-gray-900 font-semibold">{tap.item_name}</td>
                          <td className="text-right px-2 py-1.5 text-gray-600">₵{tap.price}</td>
                          <td className="text-right px-2 py-1.5 text-gray-600">{tap.quantity}</td>
                          <td className="text-right px-2 py-1.5 text-gray-900 font-semibold">₵{(Number(tap.price) * Number(tap.quantity)).toFixed(2)}</td>
                          <td className="text-center px-2 py-1.5">
                            <span className={`text-[12px] font-semibold px-2 py-1 rounded ${tap.is_gmc ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'}`}>
                              {tap.is_gmc ? 'GMC' : 'WIC'}
                            </span>
                          </td>
                          <td className="px-2 py-1.5 text-gray-600">{tap.staff_name}</td>
                          <td className="px-2 py-1.5 text-gray-600 text-[12px]">{tap.tapped_at.slice(11, 16)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  onClick={() => {
                    setLiveEditingFullTapId(null)
                    setLiveEditingCurrentDate(null)
                  }}
                  className="w-full mt-3 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                >
                  Close
                </button>
              </div>
            </div>
          )}

          {/* Add new entry modal (shown from within select modal) */}
          {liveEditingAddingNewInModal && liveEditingCurrentDate && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Add New Entry for {new Date(liveEditingCurrentDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</h3>
                <div className="space-y-3 mb-4">
                  <div className="relative">
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Item</label>
                    <input
                      type="text"
                      placeholder="Search or select item..."
                      value={liveNewEntryForm.itemId ? liveCatalogueItems.find(i => String(i.id) === liveNewEntryForm.itemId)?.name || liveNewEntryItemSearch : liveNewEntryItemSearch}
                      onChange={e => setLiveNewEntryItemSearch(e.target.value)}
                      onFocus={() => setLiveNewEntryItemSearch(liveNewEntryItemSearch)}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                    {liveNewEntryItemSearch && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded shadow-lg z-10 max-h-40 overflow-y-auto">
                        {liveCatalogueItems
                          .filter(i => i.name.toLowerCase().includes(liveNewEntryItemSearch.toLowerCase()))
                          .slice(0, 10)
                          .map(item => (
                            <button
                              key={item.id}
                              onClick={() => {
                                setLiveNewEntryForm(f => ({ ...f, itemId: String(item.id) }))
                                setLiveNewEntryItemSearch('')
                              }}
                              className="w-full text-left px-3 py-2 text-sm text-gray-900 hover:bg-blue-50 border-b border-gray-100 last:border-b-0 transition"
                            >
                              <div className="font-semibold">{item.name}</div>
                              <div className="text-[12px] text-gray-600">₵{item.selling_price || '0'}</div>
                            </button>
                          ))}
                        {liveCatalogueItems.filter(i => i.name.toLowerCase().includes(liveNewEntryItemSearch.toLowerCase())).length === 0 && (
                          <div className="px-3 py-2 text-sm text-gray-600">No items found</div>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveNewEntryForm.quantity}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, quantity: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Price (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveNewEntryForm.customPrice}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, customPrice: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={liveNewEntryForm.tappedAt}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, tappedAt: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2 p-2 border border-gray-300 rounded bg-gray-50">
                    <input
                      type="checkbox"
                      id="liveNewEntryTypeGmc"
                      checked={liveNewEntryForm.isGMC}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, isGMC: e.target.checked }))}
                      className="w-4 h-4 rounded border-gray-300 accent-blue-600"
                    />
                    <label htmlFor="liveNewEntryTypeGmc" className="text-sm font-semibold text-gray-900 cursor-pointer flex-1">
                      {liveNewEntryForm.isGMC ? '📦 GMC' : '🏪 WIC'}
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingAddingNewInModal(false)
                      setLiveNewEntryForm({ itemId: '', quantity: '', customPrice: '', tappedAt: '', isGMC: false })
                      setLiveNewEntryItemSearch('')
                    }}
                    disabled={liveNewEntrySaving}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded disabled:opacity-50 transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={async () => {
                      const item = liveCatalogueItems.find(i => String(i.id) === liveNewEntryForm.itemId)
                      if (!item || !liveNewEntryForm.quantity) {
                        showToast('Missing item or quantity', 'error')
                        return
                      }
                      setLiveNewEntrySaving(true)
                      try {
                        const res = await fetch('/api/sales/live-tap', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            itemId: item.id,
                            quantity: Number(liveNewEntryForm.quantity),
                            customPrice: liveNewEntryForm.customPrice ? Number(liveNewEntryForm.customPrice) : undefined,
                            isGMC: liveNewEntryForm.isGMC,
                            tapTime: liveNewEntryForm.tappedAt || undefined,
                          }),
                        })
                        const data = await res.json()
                        if (!res.ok) throw new Error(data.error || 'Failed to create entry')
                        setLiveTaps(prev => [data.tap, ...prev])
                        setLiveEditingAddingNewInModal(false)
                        setLiveNewEntryForm({ itemId: '', quantity: '', customPrice: '', tappedAt: '', isGMC: false })
                        setLiveNewEntryItemSearch('')
                        showToast(`✓ ${item.name} × ${liveNewEntryForm.quantity} added`, 'success')
                      } catch (e) {
                        showToast(e instanceof Error ? e.message : 'Error creating entry', 'error')
                      } finally {
                        setLiveNewEntrySaving(false)
                      }
                    }}
                    disabled={liveNewEntrySaving || !liveNewEntryForm.itemId || !liveNewEntryForm.quantity}
                    className="flex-1 px-3 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded disabled:opacity-50 transition"
                  >
                    {liveNewEntrySaving ? 'Adding...' : 'Add Entry'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Edit full tap details modal */}
          {liveEditingFullTapId != null && liveEditingFullTapId !== -1 && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Edit Log Entry</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveEditingFullTapForm.quantity}
                      onChange={e => setLiveEditingFullTapForm(f => ({ ...f, quantity: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Price (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveEditingFullTapForm.customPrice}
                      onChange={e => setLiveEditingFullTapForm(f => ({ ...f, customPrice: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={liveEditingFullTapForm.tappedAt}
                      onChange={e => setLiveEditingFullTapForm(f => ({ ...f, tappedAt: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveEditingFullTapId(null)
                      setLiveEditingCurrentDate(null)
                      setLiveEditingFullTapForm({ quantity: '', customPrice: '', tappedAt: '' })
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveEditingFullTap}
                    disabled={liveEditingFullTapSaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveEditingFullTapSaving ? 'Saving…' : 'Save'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* New log entry modal */}
          {liveNewEntryOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-2">
              <div className="bg-white rounded-lg shadow-xl max-w-sm w-full p-4 max-h-96 overflow-y-auto">
                <h3 className="text-sm font-bold text-gray-900 mb-3">Add New Log Entry</h3>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Item</label>
                    <input
                      type="text"
                      placeholder="Search item..."
                      value={liveNewEntryForm.itemId}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, itemId: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                      list="items-list"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveNewEntryForm.quantity}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, quantity: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Price (₵)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={liveNewEntryForm.customPrice}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, customPrice: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div>
                    <label className="block text-[12px] font-semibold text-gray-600 mb-1">Date & Time</label>
                    <input
                      type="datetime-local"
                      value={liveNewEntryForm.tappedAt}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, tappedAt: e.target.value }))}
                      className="w-full text-sm font-semibold text-gray-900 bg-white border border-gray-300 rounded px-3 py-2 outline-none focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="entry-is-gmc"
                      checked={liveNewEntryForm.isGMC}
                      onChange={e => setLiveNewEntryForm(f => ({ ...f, isGMC: e.target.checked }))}
                      className="w-4 h-4 cursor-pointer"
                    />
                    <label htmlFor="entry-is-gmc" className="text-[12px] font-semibold text-gray-600 cursor-pointer">
                      GMC (Grony Multimedia as Customer)
                    </label>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setLiveNewEntryOpen(false)
                      setLiveNewEntryForm({ itemId: '', quantity: '', customPrice: '', tappedAt: '', isGMC: false })
                    }}
                    className="flex-1 px-3 py-2 bg-gray-300 hover:bg-gray-400 text-gray-900 text-sm font-semibold rounded transition"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createNewLogEntry}
                    disabled={liveNewEntrySaving}
                    className="flex-1 px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded transition disabled:opacity-50"
                  >
                    {liveNewEntrySaving ? 'Creating…' : 'Create'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Sales tab -- the classic Sales Receipts list. Folded in here since it
              had nothing left that justified its own sidebar destination once the
              New Sale form was dropped and its own tap-a-sale case moved to Sale mode. */}
          {/* Sales Rec / Summary (liveMode 'sales') is retired: day totals are read-only in the Sales Log's
              analytics (SalesDaysSection), and cash counted is entered on the Log's day rows. */}

          {/* Bills tab -- BillsTab itself has no "add new" flow of its own; it always
              relied on a sibling NewBillForm rendered externally, which now lives
              inside this tab's own header instead. Same compact-header/radio-row
              treatment as Sales. */}
          {liveMode === 'bills' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <PageToolbar inline={liveExpanded} grow={false} inlineClassName="px-1.5 py-1 border-b border-gray-200 bg-gray-50 flex items-center justify-end gap-1 flex-wrap">
                <PageGuide page="bills" />
                <select value={liveBillsVendorFilter ?? ''} onChange={e => setLiveBillsVendorFilter(e.target.value || null)}
                  className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none max-w-[100px]">
                  <option value="">All Vendors</option>
                  {liveBillsAvailableVendors.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
                <select value={liveBillsMonthFilter ?? ''} onChange={e => setLiveBillsMonthFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Months</option>
                  {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m, i) => (
                    <option key={m} value={i + 1}>{m}</option>
                  ))}
                </select>
                <select value={liveBillsYearFilter ?? ''} onChange={e => setLiveBillsYearFilter(e.target.value ? Number(e.target.value) : null)}
                  className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none">
                  <option value="">All Years</option>
                  {liveBillsAvailableYears.map(y => <option key={y} value={y}>{y}</option>)}
                </select>
                {(liveBillsVendorFilter !== null || liveBillsMonthFilter !== null || liveBillsYearFilter !== null) && (
                  <button onClick={() => { setLiveBillsVendorFilter(null); setLiveBillsMonthFilter(null); setLiveBillsYearFilter(null) }}
                    className="text-[12px] font-semibold text-blue-600 hover:text-blue-700">
                    Clear
                  </button>
                )}
                <div className="border-l border-gray-300 h-4 mx-0.5" />
                <input
                  type="text"
                  value={liveEmbeddedSearch}
                  onChange={e => setLiveEmbeddedSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-20"
                />
                <label className="flex items-center gap-0.5 text-[12px] font-semibold text-gray-600 cursor-pointer select-none whitespace-nowrap">
                  <input type="radio" checked={liveBillsShowAnalytics} onClick={() => setLiveBillsShowAnalytics(a => !a)} onChange={() => {}}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Analytics
                </label>
                <ColumnsPickerButton prefs={liveBillsColPrefs} radioStyle />
              </PageToolbar>
              {/* Rows 2-3: one mutually-exclusive radio group -- All/New Bill/Bars
                  Only/History (black) first, then the violation filters (red, with
                  live counts, sorted by count descending). Same treatment as
                  Sales' row; see liveBillsRadioValue/selectLiveBillsRadio above. */}
              <div className="px-1.5 py-0.5 bg-white border-b border-gray-100 flex items-center gap-1.5 flex-wrap">
                <label className="flex items-center gap-0.5 cursor-pointer hover:underline whitespace-nowrap text-gray-700 text-[12px] shrink-0">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'all'} onChange={() => selectLiveBillsRadio('all')} className="cursor-pointer w-2.5 h-2.5" />
                  <span>All</span>
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[12px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'new_bill'} onChange={() => selectLiveBillsRadio('new_bill')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  + New Bill
                </label>
                <label title="Show only the date/vendor bars, hiding each bill's item lines"
                  className="shrink-0 flex items-center gap-0.5 text-[12px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'bars_only'} onChange={() => selectLiveBillsRadio('bars_only')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  Bars Only
                </label>
                <label className="shrink-0 flex items-center gap-0.5 text-[12px] font-semibold text-gray-600 cursor-pointer select-none">
                  <input type="radio" name="liveBillsRadio" checked={liveBillsRadioValue === 'history'} onChange={() => selectLiveBillsRadio('history')}
                    className="cursor-pointer w-2.5 h-2.5" />
                  History
                </label>
                {/* Purchase Orders and Vendors have their own sidebar rows. */}
              </div>
              {/* Bills violations moved to Critical bar at top --
                  No Vendor/No Item List/Total Mismatch/No Attachment/No Expense/VCP Jump
                  now appear in the Critical bar's Bills section to surface
                  them as a quick shortcut. */}
              {liveBillsAddingNew ? (
                <div className="px-4 flex-1 overflow-auto">
                  <NewBillForm onSuccess={() => setLiveBillsAddingNew(false)} />
                </div>
              ) : liveBillsShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><BillsAnalyticsSection /></div>
              ) : liveBillsShowPurchaseOrders ? (
                <div className="flex-1 min-h-0"><POTab search={liveEmbeddedSearch} /></div>
              ) : liveBillsShowVendors ? (
                <div className="px-4 pt-2 flex-1 overflow-auto space-y-2">
                  <VendorsPage openAddSignal={vendorSignal} initialSearch={liveEmbeddedSearch} onFlagCountChange={setVendorsFlagsCount} />
                </div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <BillsTab items={liveSalesBillsItems} groupFilter={liveGroupFilter} search={liveEmbeddedSearch} violation={liveBillsViolationFilter}
                    jumpToBillId={jumpToBillId} onJumpDone={() => setJumpToBillId(null)}
                    showHistory={liveBillsShowHistory} setShowHistory={setLiveBillsShowHistory}
                    barsOnly={liveBillsBarsOnly} setBarsOnly={setLiveBillsBarsOnly}
                    vendorFilter={liveBillsVendorFilter} setVendorFilter={setLiveBillsVendorFilter}
                    monthFilter={liveBillsMonthFilter} setMonthFilter={setLiveBillsMonthFilter}
                    yearFilter={liveBillsYearFilter} setYearFilter={setLiveBillsYearFilter}
                    gmcFilter={liveBillsGmcFilter} gmcItemIds={liveGmcItemIds}
                    colPrefs={liveBillsColPrefs}
                    onAvailableVendorsChange={setLiveBillsAvailableVendors}
                    onAvailableYearsChange={setLiveBillsAvailableYears} />
                </div>
              )}
            </div>
          )}

          {/* Expenses tab -- moved here from its own sidebar destination
              (Grony Cash's left pane), same "own liveMode tab" treatment
              Sales/Bills already got. ExpensesTab itself has no "add new" of
              its own either, same as Bills, reusing /expenses/new as a
              sibling. */}
          {liveMode === 'expenses' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              {/* One mutually-exclusive radio group (see
                  liveExpensesMainRadios above), packed tightly into a
                  single wrapping row -- color/weight is per item (variant),
                  not per row, so red flags and black views sit close
                  together regardless of how many total radios there are or
                  where a wrap falls. The toolbar utilities (Account/Type
                  filters, Search, Filter, Columns) get their own row below
                  instead of squeezing onto the last radio row. Columns
                  itself opens via a "Columns" option inside the Filter
                  select -- ColumnsPickerButton renders here with
                  hideTrigger, purely so its floating panel has somewhere to
                  anchor. New Expense is its own visible "+ New" button (below,
                  next to Search) rather than buried in the dropdown --
                  everything else -- History/property availability
                  splits/Analytics/Accounts/Laws & Tasks/Help -- still lives
                  in that same Filter dropdown. No Bars Only here -- Expenses
                  has no day-bar/item-line grouping like Sales/Bills. */}
              <div className="px-1.5 py-0.5 bg-white flex items-center flex-wrap gap-x-1.5 gap-y-0.5 border-b border-gray-200">
                {liveExpensesMainRadios.map((v, i) => (
                  <Fragment key={v.key}>
                    {i > 0 && <span className="text-gray-300 text-[12px]">·</span>}
                    {renderLiveExpensesRadio(v)}
                  </Fragment>
                ))}
              </div>
              <PageToolbar inline={liveExpanded} grow={false} inlineClassName="px-1.5 py-0.5 bg-white border-b border-gray-200 flex items-center justify-end gap-1.5 flex-wrap">
                <PageGuide page="expenses" />
                <select value={liveExpensesAccountFilter ?? ''} onChange={e => setLiveExpensesAccountFilter(e.target.value || null)}
                  className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none max-w-[80px] shrink-0">
                  <option value="">All Accounts</option>
                  {liveExpensesAccountOptions.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
                <select value={liveExpensesPropertyTypeFilter ?? ''} onChange={e => setLiveExpensesPropertyTypeFilter(e.target.value || null)}
                  className="text-[12px] text-gray-700 bg-white border border-gray-200 rounded px-1 py-0.5 outline-none max-w-[80px] shrink-0">
                  <option value="">All Types</option>
                  {EXPENSES_PROPERTY_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="text"
                  value={liveEmbeddedSearch}
                  onChange={e => setLiveEmbeddedSearch(e.target.value)}
                  placeholder="Search…"
                  className="text-xs px-1.5 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-blue-400 w-20 shrink-0"
                />
                <button onClick={() => selectLiveExpensesRadio('new_expense')}
                  className="text-xs font-semibold bg-blue-600 text-white px-2 py-1 rounded hover:bg-blue-700 shrink-0">
                  + New
                </button>
                {renderExpensesFiltersBar()}
                <ColumnsPickerButton prefs={liveExpensesColPrefs} hideTrigger open={liveExpensesColumnsOpen} onOpenChange={setLiveExpensesColumnsOpen} />
              </PageToolbar>
              {liveExpensesAddingNew ? (
                <div className="px-4 flex-1 overflow-auto">
                  <NewExpenseForm onSuccess={() => setLiveExpensesAddingNew(false)} />
                </div>
              ) : liveExpensesShowAnalytics ? (
                <div className="px-3 pt-3 flex-1 overflow-auto"><ExpensesAnalyticsSection /></div>
              ) : liveExpensesShowOrders ? (
                <div className="px-3 pt-2 flex-1 overflow-auto"><ExpenseOrdersPanel /></div>
              ) : (
                <div className="flex-1 overflow-auto">
                  <ExpensesTab search={liveEmbeddedSearch} onFlagCountChange={setExpensesFlagsCount}
                    showHistory={liveExpensesShowHistory} setShowHistory={setLiveExpensesShowHistory}
                    activeFlag={liveExpensesActiveFlag} setActiveFlag={setLiveExpensesActiveFlag}
                    onFlagCountsChange={setLiveExpensesFlagCounts}
                    groupBy={liveExpensesGroupBy} setGroupBy={setLiveExpensesGroupBy}
                    showProperties={liveExpensesShowProperties} setShowProperties={setLiveExpensesShowProperties}
                    showNonProperties={liveExpensesShowNonProperties} setShowNonProperties={setLiveExpensesShowNonProperties}
                    propertyAvailabilityFilter={liveExpensesPropertyAvailabilityFilter} setPropertyAvailabilityFilter={setLiveExpensesPropertyAvailabilityFilter}
                    propertyTypeFilter={liveExpensesPropertyTypeFilter} setPropertyTypeFilter={setLiveExpensesPropertyTypeFilter}
                    onViewCountsChange={setLiveExpensesViewCounts}
                    colPrefs={liveExpensesColPrefs}
                    showAccountsManager={liveExpensesShowAccountsManager} setShowAccountsManager={setLiveExpensesShowAccountsManager}
                    accountFilter={liveExpensesAccountFilter} setAccountFilter={setLiveExpensesAccountFilter}
                    onAccountOptionsChange={setLiveExpensesAccountOptions} />
                </div>
              )}
            </div>
          )}

          {/* Manage tab -- folds the old "Manage" (Opener/Closer/Grony
              Checks/Future/Quality Assurance/Unfortunate Events/App info --
              Advert split off into its own tab, see liveMode === 'advert'
              below) and "Team" (Team Times/Payments/Pen. Pts/Behaviour/Dress
              Code/Display/Meeting/Comp. Laws/Assessment/Rota/Logs) left-pane
              sections into one flat button row here -- one combined list, no
              Manage/Team split, styled and arranged exactly like the outer
              Sale/Log/Sales/Bills/Expenses/Manage tab switcher itself (only
              one open at a time, content swaps in below), same "own
              liveMode tab" treatment Vendors/Customers/Purchase Orders/P&L/
              CAB already got. GronyManageContent/StaffContent are reused
              as-is -- neither reads lossView directly, both are driven
              purely by their `view` prop plus the other explicit props
              below, so this just points `view` at liveManageSection instead
              of lossView. onOpenStaff (Closer's "Go to Staff →" button) is
              rewired to flip liveManageSection to Team Times locally rather
              than navigating away via pickLossView. */}
          {liveMode === 'manage' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                {canSeeManage && MANAGE_VIEW_KEYS.has(liveManageSection) && (
                  <TabErrorBoundary>
                    <GronyManageContent view={liveManageSection as ManageView}
                      canManage={canManage} categoryIds={fixedCategoryIds}
                      openerViolations={openerViolations}
                      assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                      onGoToViolation={goToViolation}
                      missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
                      onOpenStaff={() => openShop('times')}
                      propertiesInitialTab={propertiesInitialTab} />
                  </TabErrorBoundary>
                )}
                {canSeeTeam && STAFF_TEAM_ITEMS.some(t => t.key === liveManageSection) && (
                  myStaffName ? (
                    <TabErrorBoundary>
                      <StaffContent key={liveManageSection} view={liveManageSection as StaffView}
                        viewingName={viewingName} role={role} username={username}
                        canSeeTeam={canSeeTeam} canSeeUsers={canSeeUsers} canSeeRoles={canManage} canManage={canManage}
                        staffRoster={STAFF_ROSTER} routablePages={routablePages} categoryIds={fixedCategoryIds}
                        openAddSignal={staffTimeSignal} />
                    </TabErrorBoundary>
                  ) : (
                    <p className="py-10 text-center text-gray-400 text-sm px-4">No staff profile is set up for your account.</p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Advert tab -- split off from Manage's combined list since it has
              its own 8-page sub-nav (Audio, Advert Status, Jingle Log,
              Equipment Check, Photoshop, WhatsApp, Cuttings, Video). Just
              renders GronyManageContent fixed at view="advert" -- that
              component owns its own ADVERT_ITEMS radio row + selected
              sub-page internally (see GronyManageTab.tsx), so there's
              nothing else to drive from here. */}
          {liveMode === 'advert' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                <TabErrorBoundary>
                  <GronyManageContent view="advert"
                    canManage={canManage} categoryIds={fixedCategoryIds}
                    openerViolations={openerViolations}
                    assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                    onGoToViolation={goToViolation}
                    missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
                    onOpenStaff={() => openShop('times')}
                    propertiesInitialTab={propertiesInitialTab} />
                </TabErrorBoundary>
              </div>
            </div>
          )}

          {/* Shop checks (opened from the Shop's Manage tab) -- same split as Advert
              just above, for the same reason (its own sub-nav: the Grony
              Checks Grid table, plus Arrangement/Cleanliness/Customer
              Display/Repair Works/Grony 1-10/Security chk). Just renders
              GronyManageContent fixed at view="grony_checks" -- it owns its
              own GRONY_CHECKS_ITEMS radio row + selected sub-page
              internally. */}
          {liveMode === 'gronyChecks' && (
            <div className={liveRootClassName}>
              {liveExpanded && (
                <button
                  type="button"
                  onClick={() => setLiveExpanded(false)}
                  title="Exit large screen"
                  className="fixed top-2 right-2 z-[60] w-8 h-8 rounded-full bg-gray-900/80 text-white text-sm font-bold flex items-center justify-center shadow-lg hover:bg-gray-900 transition"
                >
                  ✕
                </button>
              )}
              {renderModeToggleRow()}
              <div className="flex-1 min-h-0 overflow-y-auto p-2">
                <TabErrorBoundary>
                  <GronyManageContent view="grony_checks"
                    canManage={canManage} categoryIds={fixedCategoryIds}
                    openerViolations={openerViolations}
                    assignments={assignments} deadlines={deadlines} assignedBy={assignedBy} assignedOn={assignedOn} vSettings={vSettings}
                    onGoToViolation={goToViolation}
                    missingClosingReportsCount={globalFlags?.missingClosingReports?.length ?? 0}
                    onOpenStaff={() => openShop('times')}
                    propertiesInitialTab={propertiesInitialTab} />
                </TabErrorBoundary>
              </div>
            </div>
          )}

          {/* Every count-related view that used to only be reachable through the
              laws panel (⚖️) on Sale mode: Daily/Every Nd/Dormant/etc
              (liveCountIntervalFlags), Count Records (the full all-time history
              table), and Count History (the audit log of who counted/edited/
              deleted what). Moved to its own tab since they're audit/browse
              views, not part of actually tapping a sale. */}
          {/* Sale mode (the default/landing mode) -- deferred from SSR by checking
              liveSaleMounted, which only becomes true after hydration. This prevents
              the server from spending 12+ seconds rendering this 700+ line feature. */}
          {liveMode === 'sale' && !liveSaleMounted && (
            <div className={liveRootClassName + ' flex items-center justify-center'}>
              <div className="text-center space-y-2">
                <div className="inline-block w-8 h-8 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Loading Live…</p>
              </div>
            </div>
          )}
          {<HubLiveDebug h={h} />}

          <div className="fixed bottom-4 right-4 z-40 flex flex-col items-end gap-2">
            
          </div>
          {/* Global Search's own permanent floating trigger -- mirrors Laws &
              Tasks/Help's bottom-right pair, but bottom-left so it's never
              squeezed out of view by however many buttons the tab switcher
              above happens to have (now bottom-right, clear of the left sidebar) (it used to live inline in that row,
              gated to lossView === 'sales' only, which also meant it never
              showed at all while browsing via Items). Offset above the
              sidebar-restore ▶ button's own bottom-left spot (only shown
              while the sidebar is hidden) so the two never overlap. */}
          <GlobalMic frame={embedRef} dests={voiceDests}
            onVoiceSale={outerTab === 'loss' && lossView === 'items' && liveSaleType !== 'GMC' && !embedUrl && !personal ? (t: string) => { setVoiceSaleText(t); setVoiceSaleSignal(n => n + 1) } : undefined}
            className={`fixed ${outerTab === 'loss' && canSeeCash && !sidePaneHidden ? 'bottom-4' : 'bottom-16'} ${isDesktop && outerTab === 'loss' && (canSeeManage || canSeeTeam) ? 'right-40' : 'right-4'}`} />
          {/* Scan a barcode: on Live Sale it opens the sale card with that item; on any other page the item's name goes into the page's search box. */}
          <ScanButton className={`fixed ${outerTab === 'loss' && canSeeCash && !sidePaneHidden ? 'bottom-4' : 'bottom-16'} ${isDesktop && outerTab === 'loss' && (canSeeManage || canSeeTeam) ? 'right-40' : 'right-4'} -translate-y-14`}
            onItem={it => {
              if (outerTab === 'loss' && lossView === 'items' && liveSaleType !== 'GMC' && !embedUrl && !personal) { setScanItem(it); setScanSignal(n => n + 1); return }
              const ev = { item: { id: it.id, name: it.name }, handled: false }
              window.dispatchEvent(new CustomEvent('scan-item', { detail: ev })) // the Counts page opens its count box for this item
              if (ev.handled) return
              let doc: Document | null = null; try { doc = embedRef.current?.contentDocument ?? null } catch { /* ignore */ }
              if (!fillSearchBox(doc ?? document, it.name)) showToast(`Scanned: ${it.name} (₵${it.selling_price})`, 'success')
            }} />
          {clockGateOpen && (
            <ClockInGateModal onClockedIn={() => resolveClockGate(true)} onSkip={() => resolveClockGate(false)} />
          )}
          {negPrompt && (
            <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4">
              <div className="w-full max-w-sm space-y-3 rounded-2xl bg-white p-4 shadow-2xl">
                <p className="text-base font-extrabold text-red-700">🔻 Count the shelf now</p>
                <p className="text-sm text-gray-800">The sale is recorded. But the records now show <b>{negPrompt.soh}</b> of <b>{negPrompt.name}</b>, which cannot be true. Count what is really on the shelf and enter it, so the stock is corrected.</p>
                <button type="button" onClick={() => { setNegPrompt(null); goCountMode(); setLiveSaleViolationFilter('negSoh'); setLiveSaleView({ kind: 'negative_soh_chart' }) }} className="w-full rounded-xl bg-red-600 py-2.5 text-sm font-bold text-white">Count it now</button>
                <button type="button" onClick={() => setNegPrompt(null)} className="w-full rounded-xl bg-gray-100 py-2 text-xs font-bold text-gray-600">Later (it stays under Negative stock)</button>
              </div>
            </div>
          )}
          {outerTab === 'loss' && lossView === 'items' && liveSaleType !== 'GMC' && !embedUrl && !personal && (
            <VoiceSale openSignal={voiceSaleSignal} spoken={voiceSaleText} scanItem={scanItem} scanSignal={scanSignal} onRecorded={tap => { setLiveTaps(prev => [tap as Tap, ...prev]); showToast('Sale recorded by voice', 'success') }} />
          )}
          {gmcOverageGate && (
            <GmcOverageGateModal
              itemName={gmcOverageGate.itemName}
              targetName={gmcOverageGate.targetName}
              given={gmcOverageGate.given}
              used={gmcOverageGate.used}
              exhaustedOnDate={gmcOverageGate.exhaustedOnDate}
              onGoToCount={() => resolveOverageGate('count')}
              onGoToGmc={() => resolveOverageGate('gmc')}
              onContinue={() => resolveOverageGate('continue')}
            />
          )}
          {gmcPropertyPrompt && (
            <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 px-4">
              <div className="bg-white rounded-2xl shadow-xl max-w-xs w-full p-4 space-y-3">
                <p className="text-sm font-bold text-gray-900">Mark as a property?</p>
                <p className="text-xs text-gray-600">
                  "{gmcPropertyPrompt.itemName}" was just drawn from GMC stock. If this was taken for the business's own use
                  (not resold), mark it as a property now -- it won't show up as an expense.
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <button type="button" disabled={gmcPropertySaving}
                    onClick={async () => {
                      setGmcPropertySaving(true)
                      try {
                        await fetch('/api/properties', {
                          method: 'POST', headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({
                            itemId: gmcPropertyPrompt.itemId, sourceLiveSaleTapId: gmcPropertyPrompt.tapId,
                            name: gmcPropertyPrompt.itemName, amount: gmcPropertyPrompt.amount,
                          }),
                        })
                        showToast(`✓ ${gmcPropertyPrompt.itemName} marked as property`, 'success')
                      } catch {
                        showToast('Could not save property -- try again from the Properties tab', 'error')
                      } finally {
                        setGmcPropertySaving(false)
                        setGmcPropertyPrompt(null)
                      }
                    }}
                    className="flex-1 text-xs font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg py-2">
                    {gmcPropertySaving ? 'Saving…' : 'Yes, mark as property'}
                  </button>
                  <button type="button" disabled={gmcPropertySaving} onClick={() => setGmcPropertyPrompt(null)}
                    className="flex-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg py-2">
                    No
                  </button>
                </div>
              </div>
            </div>
          )}

          {liveSortOrderModalOpen && (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setLiveSortOrderModalOpen(false)}>
              <div className="bg-white rounded-lg shadow-xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900">Arrange Item Order</h2>
                  <button type="button" onClick={() => setLiveSortOrderModalOpen(false)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">×</button>
                </div>
                <div className="p-4 space-y-3">
                  <p className="text-xs text-gray-500">
                    Sets the priority order the Sale grid arranges items in -- top wins ties
                    against the ones below it. This is shared: whoever changes it changes
                    what every staff member's app shows, not just yours.
                  </p>
                  <div className="space-y-1.5">
                    {liveItemSortOrder.map((key, i) => (
                      <div key={key} className="flex items-center justify-between gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <span className="text-sm text-gray-800">
                          <span className="text-gray-400 font-mono mr-2">{i + 1}.</span>
                          {ITEM_SORT_LABELS[key]}
                        </span>
                        <div className="flex gap-1 shrink-0">
                          <button type="button" disabled={i === 0} onClick={() => moveItemSortKey(key, -1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-30 hover:bg-gray-100 flex items-center justify-center text-xs">▲</button>
                          <button type="button" disabled={i === liveItemSortOrder.length - 1} onClick={() => moveItemSortKey(key, 1)}
                            className="w-6 h-6 rounded bg-white border border-gray-300 text-gray-600 disabled:opacity-30 hover:bg-gray-100 flex items-center justify-center text-xs">▼</button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </> ) : null}</>)
}
