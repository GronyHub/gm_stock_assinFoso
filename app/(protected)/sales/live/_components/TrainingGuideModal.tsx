'use client'

import { useState } from 'react'

export function TrainingGuideModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const [scrollPosition, setScrollPosition] = useState(0)

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-center justify-center p-4" onClick={(e) => e.stopPropagation()}>
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
          {/* Header */}
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
            <h1 className="text-2xl font-bold text-blue-600">Live Sales Training</h1>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-2xl font-light leading-none"
              aria-label="Close"
            >
              ✕
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6 text-gray-900 text-sm space-y-6">
            {/* Section 1 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">1</span>
                What is Live Sale?
              </h2>
              <p className="mb-3">Live Sale lets you record sales <strong>one item at a time as they're sold</strong>, instead of writing down the entire receipt at the end of the day.</p>
              <ul className="space-y-2 ml-11">
                <li><strong>📊 Real-time tracking</strong> — Each tap is recorded immediately</li>
                <li><strong>⚡ Fast for busy counters</strong> — Perfect when customers are buying throughout the day</li>
                <li><strong>🔄 One receipt per day</strong> — All walk-in sales combine into a single daily receipt</li>
              </ul>
            </div>

            {/* Section 2 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">2</span>
                Getting to Live Sale
              </h2>
              <ol className="space-y-2 ml-11">
                <li><strong>1.</strong> Go to <strong>Sales</strong> in the left menu</li>
                <li><strong>2.</strong> Click <strong>Live Sale</strong></li>
                <li><strong>3.</strong> You'll see a grid of items ready to tap</li>
              </ol>
            </div>

            {/* Section 3 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">3</span>
                Tapping an Item
              </h2>
              <p className="mb-2"><strong>Standard Taps:</strong></p>
              <ul className="space-y-1 ml-6 mb-3">
                <li>• <strong>For goods:</strong> [1], [2], [3] units</li>
                <li>• <strong>For services:</strong> [1], [10], [15] units</li>
              </ul>
              <p className="text-xs bg-blue-50 border border-blue-200 rounded p-2 ml-6">💡 <strong>Pro tip:</strong> Use the preset buttons whenever possible—they're faster than typing.</p>
            </div>

            {/* Section 4 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">4</span>
                Custom Amounts
              </h2>
              <p className="mb-2">If a customer wants a non-standard quantity (e.g., 7 instead of 10):</p>
              <ol className="space-y-2 ml-6">
                <li><strong>1.</strong> Find the <strong>"+"</strong> input field at the end of the item row</li>
                <li><strong>2.</strong> Type the quantity (e.g., "7")</li>
                <li><strong>3.</strong> Press <strong>Enter</strong> or click the green <strong>✓</strong></li>
              </ol>
            </div>

            {/* Section 5 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">5</span>
                Undo a Tap
              </h2>
              <p className="mb-2"><strong>Immediate undo:</strong> Click "Undo" on the green notification</p>
              <p className="mb-2"><strong>Later undo:</strong> Go to Log tab, find the tap, click "Undo"</p>
              <p className="text-xs bg-yellow-50 border border-yellow-200 rounded p-2 ml-6">⚠️ Undoing does NOT lose the sale—it's just removed from the total.</p>
            </div>

            {/* Section 6 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">6</span>
                The Log View
              </h2>
              <p className="mb-2">Click the <strong>Log</strong> tab to see all taps from today and past days.</p>
              <ul className="space-y-2 ml-6">
                <li>📅 <strong>Grouped by date</strong> — Today's sales appear first</li>
                <li>⏱️ <strong>Columns shown</strong> — Item, Time, Price, Qty, Total, Staff</li>
                <li>👤 <strong>Staff filter</strong> — Click a staff name to see only their sales</li>
              </ul>
            </div>

            {/* Section 7 */}
            <div>
              <h2 className="text-lg font-bold mb-3">
                <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm mr-3">7</span>
                Best Practices
              </h2>
              <div className="space-y-2 ml-6">
                <p><strong>✓ Tap immediately</strong> — Record each sale as soon as it happens</p>
                <p><strong>✓ Use presets</strong> — Faster than typing custom amounts</p>
                <p><strong>✓ Arrange top items</strong> — Long-press item name to move to top</p>
                <p><strong>✓ Check Log daily</strong> — Verify all sales match your cash total</p>
                <p className="text-yellow-700"><strong>✗ Don't batch taps</strong> — Tap one at a time</p>
                <p className="text-yellow-700"><strong>✗ Don't use for named customers</strong> — Use "New Sale" instead</p>
              </div>
            </div>

            {/* Quick Ref */}
            <div className="bg-blue-50 border border-blue-200 rounded p-4">
              <h3 className="font-bold text-blue-900 mb-2">❓ Troubleshooting</h3>
              <ul className="space-y-1 text-xs">
                <li><strong>Item not showing?</strong> Use search or check group filter</li>
                <li><strong>Wrong item tapped?</strong> Click Undo immediately or from Log</li>
                <li><strong>Can't find Log?</strong> Swipe left on grid or tap Log button</li>
                <li><strong>Receipt total wrong?</strong> Check Log for undone taps (crossed-out)</li>
              </ul>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-gray-200 bg-gray-50 px-6 py-3 text-center text-xs text-gray-600">
            <button
              onClick={onClose}
              className="text-blue-600 font-semibold hover:underline"
            >
              Close Guide
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
