'use client'
import { useState, useEffect } from 'react'

// Manage's left-pane row data + its dynamic (user-added) categories state,
// split out from GronyManageTab.tsx so item/page.tsx can build the merged
// Grony Cash pane and own this state without pulling in (and bundling)
// GronyManageContent's actual content components (ContentPage, TasksView,
// etc.) just to render the list of buttons.
export type ManageView =
  | 'opener' | 'closer'
  | 'rota'
  | 'audio' | 'audio_status' | 'jingle' | 'equipment' | 'photoshop' | 'whatsapp' | 'cuttings' | 'video' | 'advert_log'
  | 'staff_dress'
  | 'arrangement' | 'cleanliness' | 'future' | 'customer_display'
  | 'staff_display' | 'repair_works' | 'quality_assurance' | 'staff_meeting'
  | 'tutorial' | 'training_laws' | 'assessment'
  | 'logs' | 'properties'

// Simple dated log/checklist categories -- no existing data behind them, so
// each gets a ManageLogPanel (notes + optional photo, viewable as history).
export const LOG_CATEGORIES: { key: ManageView; label: string; icon: string }[] = [
  { key: 'arrangement',      label: 'Arrangement',       icon: '🪑' },
  { key: 'cleanliness',      label: 'Cleanliness',       icon: '🧹' },
  { key: 'future',           label: 'Future',            icon: '🔭' },
  { key: 'customer_display', label: 'Customer Display',  icon: '🖼️' },
  { key: 'staff_display',    label: 'Staff Display',     icon: '📌' },
  { key: 'repair_works',     label: 'Repair Works',      icon: '🔧' },
  { key: 'quality_assurance', label: 'Quality Assurance', icon: '✅' },
  { key: 'staff_meeting',    label: 'Staff Meeting',     icon: '🗣️' },
]

// The Manage section's fixed contents, top to bottom -- one flat list, no
// nested groups. Home/Daily aren't here -- they're the merged pane's shared
// footer now (see PaneHomeDaily in page.tsx), not Manage-specific rows.
export const MANAGE_LIST_ITEMS: { key: ManageView; label: string; icon?: string }[] = [
  { key: 'opener', label: 'Opener', icon: '🌅' },
  { key: 'closer', label: 'Closer', icon: '🌙' },
  { key: 'audio', label: 'Audio', icon: '🎙️' },
  { key: 'audio_status', label: 'Advert Status', icon: '📋' },
  { key: 'jingle', label: 'Jingle Log', icon: '🎵' },
  { key: 'equipment', label: 'Equipment Check', icon: '🔊' },
  { key: 'photoshop', label: 'Photoshop', icon: '🖌️' },
  { key: 'whatsapp', label: 'WhatsApp', icon: '💬' },
  { key: 'cuttings', label: 'Cuttings', icon: '✂️' },
  { key: 'video', label: 'Video', icon: '🎬' },
  { key: 'advert_log', label: 'Daily Log', icon: '📢' },
  { key: 'staff_dress', label: 'Dress Code', icon: '👕' },
  ...LOG_CATEGORIES.map(c => ({ key: c.key, label: c.label, icon: c.icon })),
  { key: 'tutorial', label: 'Tutorial', icon: '📖' },
  { key: 'training_laws', label: 'Company Laws', icon: '⚖️' },
  { key: 'assessment', label: 'Assessment', icon: '📝' },
  { key: 'rota', label: 'Rota', icon: '🗓️' },
  { key: 'logs', label: 'Logs', icon: '📜' },
  { key: 'properties', label: 'Properties', icon: '🏷️' },
]

export type DynamicCategory = { id: number; label: string }

// Owns the fetch/add/remove lifecycle for Manage's user-added categories --
// shared between the merged pane (listing them + the add-category form) and
// GronyManageContent (rendering the active one via DynamicCategoryPage).
export function useDynamicManageCategories() {
  const [dynamicCategories, setDynamicCategories] = useState<DynamicCategory[]>([])
  const [activeDynamicId, setActiveDynamicId] = useState<number | null>(null)
  const [showAddCategory, setShowAddCategory] = useState(false)
  const [newCategoryLabel, setNewCategoryLabel] = useState('')
  const [savingCategory, setSavingCategory] = useState(false)
  const [justAddedCategory, setJustAddedCategory] = useState(false)

  function loadDynamicCategories() {
    fetch('/api/manage-categories').then(r => r.ok ? r.json() : []).then(d => {
      setDynamicCategories(Array.isArray(d) ? d : [])
    }).catch(() => {})
  }
  useEffect(() => { loadDynamicCategories() }, [])

  async function addCategory(e: React.FormEvent) {
    e.preventDefault()
    if (!newCategoryLabel.trim() || savingCategory) return
    setSavingCategory(true)
    const res = await fetch('/api/manage-categories', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label: newCategoryLabel.trim() }),
    })
    setSavingCategory(false)
    if (res.ok) {
      const row = await res.json()
      setNewCategoryLabel(''); setShowAddCategory(false)
      loadDynamicCategories()
      setActiveDynamicId(row.id)
      setJustAddedCategory(true)
      setTimeout(() => setJustAddedCategory(false), 2500)
    }
  }

  async function removeCategory(id: number, label: string) {
    if (!confirm(`Delete "${label}" and everything in it?`)) return
    await fetch(`/api/manage-categories?id=${id}`, { method: 'DELETE' }).catch(() => {})
    if (activeDynamicId === id) setActiveDynamicId(null)
    loadDynamicCategories()
  }

  return {
    dynamicCategories, activeDynamicId, setActiveDynamicId,
    showAddCategory, setShowAddCategory, newCategoryLabel, setNewCategoryLabel,
    savingCategory, justAddedCategory, addCategory, removeCategory,
  }
}
