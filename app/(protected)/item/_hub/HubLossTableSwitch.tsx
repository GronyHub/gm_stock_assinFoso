'use client'
import { LeastSalesChart, LeastPurchasedChart } from './hubShared'
import type { HubCtx } from './useHubState'
import HubItemsLoading from './HubItemsLoading'

export default function HubLossTableSwitch({ h }: { h: HubCtx }) {
  const { violation, liveSaleView, liveSaleViolationFilter, items, groups, renderCountDueChart, renderNegativeSohChart, renderLossesByDateTable, renderLossesByItemsTable, getViolationDescription } = h
  return (<>{liveSaleView?.kind === 'loss_by_date' ? (
                renderLossesByDateTable()
              ) : liveSaleView?.kind === 'loss_by_items' ? (
                renderLossesByItemsTable()
              ) : liveSaleView?.kind === 'net_loss' ? (
                renderLossesByItemsTable(true)
              ) : liveSaleView?.kind === 'least_sales_services' ? (
                <div className="flex-1 overflow-y-auto"><LeastSalesChart kind="services" /></div>
              ) : liveSaleView?.kind === 'least_sales_goods' ? (
                <div className="flex-1 overflow-y-auto"><LeastSalesChart kind="goods" /></div>
              ) : liveSaleView?.kind === 'least_sales_groups' ? (
                <div className="flex-1 overflow-y-auto"><LeastSalesChart kind="groups" /></div>
              ) : liveSaleView?.kind === 'count_due_chart' ? (
                renderCountDueChart()
              ) : liveSaleView?.kind === 'negative_soh_chart' ? (
                renderNegativeSohChart()
              ) : liveSaleView?.kind === 'least_purchased' ? (
                <div className="flex-1 overflow-y-auto"><LeastPurchasedChart /></div>
              ) : (
              <div className="flex-1 overflow-y-auto">
                {/* Violation Description Panel - scrolls with items */}
                {liveSaleViolationFilter !== 'noViolations' && (
                  (() => {
                    const violation = getViolationDescription(liveSaleViolationFilter)
                    return violation ? (
                      <div className="bg-white border-l-4 border-blue-400 p-4 mx-2 my-2 rounded text-sm">
                        <h3 className="font-semibold text-blue-900 mb-2">{violation.title}</h3>
                        <p className={`text-blue-800 ${violation.steps.length > 0 ? 'mb-3' : ''}`}>{violation.description}</p>
                        {violation.steps.length > 0 && (
                          <div className="text-blue-900">
                            <p className="font-semibold mb-2">How to fix:</p>
                            <ol className="list-decimal list-inside space-y-1">
                              {violation.steps.map((step, i) => (
                                <li key={i} className="text-blue-800 text-xs">{step}</li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    ) : null
                  })()
                )}

                {<HubItemsLoading h={h} />}
              </div>
              )}</>)
}
