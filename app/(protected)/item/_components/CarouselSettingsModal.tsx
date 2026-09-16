'use client'
import { useState } from 'react'

type CarouselSettings = {
  display_in_carousel: boolean
  carousel_message: string | null
  carousel_order: number | null
  carousel_type: 'help' | 'law' | 'announcement'
}

export default function CarouselSettingsModal({
  lawId,
  initialSettings,
  onClose,
  onSave,
}: {
  lawId: number
  initialSettings: CarouselSettings
  onClose: () => void
  onSave: (settings: CarouselSettings) => void
}) {
  const [settings, setSettings] = useState<CarouselSettings>(initialSettings)
  const [saving, setSaving] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/page-laws/carousel', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: lawId, ...settings }),
      })

      if (res.ok) {
        onSave(settings)
        onClose()
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-sm p-4 space-y-3">
        <h2 className="text-sm font-bold text-gray-900">Carousel Settings</h2>

        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={settings.display_in_carousel}
            onChange={e => setSettings(s => ({ ...s, display_in_carousel: e.target.checked }))}
            className="w-4 h-4"
          />
          <span className="text-xs text-gray-700">Show in carousel</span>
        </label>

        {settings.display_in_carousel && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Carousel message</label>
              <textarea
                value={settings.carousel_message || ''}
                onChange={e => setSettings(s => ({ ...s, carousel_message: e.target.value || null }))}
                placeholder="Custom message to display in carousel (leave blank to use law text)"
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
                rows={2}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Type</label>
              <select
                value={settings.carousel_type}
                onChange={e => setSettings(s => ({ ...s, carousel_type: e.target.value as any }))}
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
              >
                <option value="help">Help</option>
                <option value="law">Law</option>
                <option value="announcement">Announcement</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Order</label>
              <input
                type="number"
                value={settings.carousel_order || ''}
                onChange={e => setSettings(s => ({ ...s, carousel_order: e.target.value ? Number(e.target.value) : null }))}
                placeholder="0"
                className="w-full text-xs bg-gray-50 border border-gray-200 rounded px-2 py-1 outline-none focus:ring-1 focus:ring-blue-400"
              />
            </div>
          </>
        )}

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 text-xs font-semibold px-3 py-1.5 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-40"
          >
            {saving ? '…' : 'Save'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 text-xs font-semibold px-3 py-1.5 rounded bg-gray-100 text-gray-700 hover:bg-gray-200"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
