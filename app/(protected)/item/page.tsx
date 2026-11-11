'use client'
import { Suspense } from 'react'
import NewCustomerForm from './_components/NewCustomerForm'
import MIBasket from './_components/MIBasket'
import TapCustomerSheet from './_components/TapCustomerSheet'
import SelectedReceiptSheet from './_components/SelectedReceiptSheet'
import { formatPrice } from './_hub/hubShared'
import { useHubState } from './_hub/useHubState'
import HubMainRow from './_hub/HubMainRow'
import HubGlobalSearch from './_hub/HubGlobalSearch'

// The Items hub: sidebar, staff bar, the Shop and personal overlays and every Items / Sales / Cash view. State and handlers live in _hub/useHubState.tsx;
// the big view blocks are separate components in _hub/ that read the same state.
function ItemHubPageInner() {
  const h = useHubState()
  const { outerTab, search, items, isDesktop, navHeightPx, liveTaps, liveSaleType, custNameRef, tapCustomerSheet, setTapCustomerSheet, rcptSelect, setRcptSelect, rcptSel, setRcptSel, rcptSheet, setRcptSheet, miOn, setMiOn, miLines, setMiLines, miCustomer, setMiCustomer, miDate, setMiDate, miBusy, miError, registerFor, setRegisterFor, waPrompt, setWaPrompt, toasts, reloadLiveTaps, miComplete } = h
  return (
    <div className="-mx-4 -mt-4 -mb-6 flex flex-col h-[100dvh]"
      style={isDesktop ? { height: `calc(100dvh - ${navHeightPx}px)` } : { height: 'calc(100dvh - var(--svc-strip-h, 0px))' }}>

      {/* <InfoCarousel /> */}

      {/* ── Body ── No separate header row any more -- Grony Cash/UK/C&H
          (formerly the top tab row) and global search now live inside the
          pane's own footer instead (see below), so the pane itself reaches
          the very top of the screen. The pane is no longer Cash-specific
          either: it renders regardless of outerTab, so Today/UK/C&H all get
          it alongside their own content instead of losing all navigation
          the moment you leave Grony Cash. */}
      <HubMainRow h={h} />

      {/* Global search overlay -- click outside/× closes it; each result
          jumps straight to the right tab (and, for Sales/Bills/Customers/
          Vendors, pre-fills that tab's own search with the match) or
          straight to the item's 360 page. */}
      {<HubGlobalSearch h={h} />}

      {rcptSelect && rcptSel.size > 0 && !rcptSheet && (() => {
        const chosen = liveTaps.filter(t => rcptSel.has(t.id))
        const tot = chosen.reduce((s, t) => s + Number(t.price) * t.quantity, 0)
        return (
          <div className="fixed bottom-4 left-1/2 z-[90] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-orange-300">
            <p className="flex-1 text-xs font-semibold text-gray-800">{chosen.length} selected · ₵{formatPrice(tot)}</p>
            <button type="button" onClick={() => setRcptSel(new Set())} className="px-2 text-xs font-semibold text-gray-500">Clear</button>
            <button type="button" onClick={() => setRcptSheet(true)} className="rounded-lg bg-orange-500 px-3 py-2 text-xs font-bold text-white">Create receipt</button>
          </div>
        )
      })()}
      {rcptSheet && (
        <SelectedReceiptSheet taps={liveTaps.filter(t => rcptSel.has(t.id))}
          onClose={() => setRcptSheet(false)}
          onRegister={(phone, done) => setRegisterFor({ phone, done })}
          onDone={r => {
            setRcptSheet(false); setRcptSelect(false); setRcptSel(new Set()); reloadLiveTaps()
            setWaPrompt({ url: r.whatsappUrl ?? '', label: `receipt ${r.invoiceNumber}`, printUrl: r.printUrl, invoiceId: r.invoiceId })
          }} />
      )}
      {tapCustomerSheet && (
        <TapCustomerSheet tapId={tapCustomerSheet.id} allTaps={liveTaps}
          onClose={() => setTapCustomerSheet(null)} onChanged={reloadLiveTaps}
          onRegister={(phone, done) => setRegisterFor({ phone, done })} />
      )}
      {registerFor && (
        <div className="fixed inset-0 z-[250] flex items-start justify-center overflow-y-auto bg-black/40 p-3">
          <div className="my-4 w-full max-w-lg">
            <NewCustomerForm initialPhone={registerFor.phone}
              onCancel={() => setRegisterFor(null)}
              onCreated={c => { if (c.customer_id_code) registerFor.done(c.customer_id_code); setRegisterFor(null) }} />
          </div>
        </div>
      )}
      {miOn && liveSaleType !== 'GMC' && (
        <MIBasket onClose={() => setMiOn(false)} lines={miLines} busy={miBusy} error={miError}
          onAddItem={h => setMiLines(prev => {
            const at = prev.findIndex(l => l.itemId === h.id)
            if (at >= 0) return prev.map((l, i) => i === at ? { ...l, qty: String((Number(l.qty) || 0) + 1) } : l)
            return [...prev, { itemId: h.id, name: h.name, qty: '1', price: String(Number(h.selling_price) || '') }]
          })}
          onQty={(id, v) => setMiLines(prev => prev.map(l => l.itemId === id ? { ...l, qty: v } : l))}
          onPrice={(id, v) => setMiLines(prev => prev.map(l => l.itemId === id ? { ...l, price: v } : l))}
          onRemove={id => setMiLines(prev => prev.filter(l => l.itemId !== id))}
          customer={miCustomer} onCustomer={setMiCustomer} onName={n => { custNameRef.current = n }}
          onRegister={(phone, done) => setRegisterFor({ phone, done })}
          date={miDate} onDate={setMiDate} onComplete={() => void miComplete()}
          onClear={() => { if (confirm('Remove all items from the basket?')) setMiLines([]) }} />
      )}
      {waPrompt && (
        <div className="fixed bottom-4 left-1/2 z-[100] flex w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 items-center gap-2 rounded-xl bg-white p-3 shadow-lg ring-1 ring-green-300">
          <p className="flex-1 text-xs font-semibold text-gray-800">{waPrompt.url ? `Send the ${waPrompt.label} to the customer on WhatsApp?` : `${waPrompt.label} saved.`}</p>
          {waPrompt.printUrl && (
            <a href={waPrompt.printUrl} target="_blank" rel="noopener noreferrer" className="rounded-lg bg-gray-700 px-3 py-2 text-xs font-bold text-white">Print</a>
          )}
          {waPrompt.url && (
            <a href={waPrompt.url} target="_blank" rel="noopener noreferrer"
              onClick={() => {
                // Remember that this message was sent: the Sales Log's WA column shows it.
                if (waPrompt.buyerIds?.length || waPrompt.invoiceId) {
                  void fetch('/api/sales/wa-sent', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ buyerIds: waPrompt.buyerIds, invoiceId: waPrompt.invoiceId }) })
                    .then(() => reloadLiveTaps()).catch(() => {})
                }
                setWaPrompt(null)
              }}
              className="rounded-lg bg-green-600 px-3 py-2 text-xs font-bold text-white">Send</a>
          )}
          <button type="button" onClick={() => setWaPrompt(null)} className="px-1 text-lg leading-none text-gray-400">&times;</button>
        </div>
      )}

      {/* Global toast notifications */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`px-4 py-2 rounded-lg text-sm font-semibold text-white shadow-lg pointer-events-auto animate-in fade-in slide-in-from-right-4 duration-300 ${
              toast.type === 'success' ? 'bg-green-600' :
              toast.type === 'error' ? 'bg-red-600' :
              'bg-blue-600'
            }`}
          >
            {toast.type === 'success' && '✓ '}
            {toast.type === 'error' && '✗ '}
            {toast.message}
          </div>
        ))}
      </div>

    </div>
  )
}


export default function ItemHubPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-gray-400 text-xs">Loading…</div>}>
      <ItemHubPageInner />
    </Suspense>
  )
}
