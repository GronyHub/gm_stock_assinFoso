// The Manage tiles that are one area each: a tile opens its area page (Rules, Record, Done, Not done). Each area is the laws of one law tile (areaKey, see lib/lawAreas.ts) narrowed to
// its own subcategories, so the same laws are never in two areas. NONE matches no law (an area with no laws yet: the owner adds them there).
export type AreaCfg = { areaKey: string; label: string; icon: string; categories: string[]; subs: string[]; assign?: string }
const NONE = ['(none)']
const SD = 'Shop display & arrangement', EQ = 'Equipment, power & repairs', SP = 'Security & privacy', CS = 'Customer service', AD = 'Adverts & marketing', ST = 'Staff management'

export const AREA_CONFIG: Record<string, AreaCfg> = {
  cleanliness: { areaKey: 'clean', label: 'Cleanliness', icon: '🧹', categories: ['Cleanliness & safety'], subs: ['Daily cleaning', 'Weekly cleaning', 'Closing clean-up', 'Computers', 'Front panel'] },
  arrangement: { areaKey: 'display', label: 'Arrangement', icon: '🪑', categories: [SD], subs: ['Arrangement', 'Arranging goods', 'Storage'] },
  customer_display: { areaKey: 'display', label: 'Customer Display', icon: '🖼️', categories: [SD], subs: ['Customer display'] },
  repair_works: { areaKey: 'equipment', label: 'Repair Works', icon: '🔧', categories: [EQ], subs: ['Repairs'] },
  security_chk: { areaKey: 'security', label: 'Security chk', icon: '🔒', categories: [SP], subs: ['Locking up', 'CCTV', 'Accounts', 'Customer data', 'Personal numbers'] },
  unfortunate_events: { areaKey: 'security', label: 'Unfortunate Events', icon: '🚨', categories: [SP], subs: ['Unfortunate events'] },
  quality_assurance: { areaKey: 'service', label: 'Quality Assurance', icon: '✅', categories: [CS], subs: ['Quality of work'] },
  customer_service: { areaKey: 'service', label: 'Customer service', icon: '🤝', categories: [CS], subs: ['Receiving a customer', 'Receiving customers', 'Interacting', 'Doing the work', 'Identity and appearance', 'Complaints', 'Complaints and difficult customers', 'Callbacks', 'Closing and aftercare', 'Money, privacy and receipts', 'Pending jobs', 'Staff conduct'] },
  audio: { areaKey: 'adverts', label: 'Audio', icon: '🎙️', categories: [AD], subs: NONE },
  audio_status: { areaKey: 'adverts', label: 'Advert Status', icon: '📋', categories: [AD], subs: ['Posting', 'Replies', 'Accounts'] },
  jingle: { areaKey: 'adverts', label: 'Jingle Log', icon: '🎵', categories: [AD], subs: ['Ideas'] },
  equipment: { areaKey: 'equipment', label: 'Equipment Check', icon: '🔊', categories: [EQ], subs: ['Power', 'Printers', 'Computers', 'Phones', 'Closing', 'Properties'] },
  photoshop: { areaKey: 'adverts', label: 'Photoshop', icon: '🖌️', categories: [AD], subs: ['Making adverts'] },
  whatsapp: { areaKey: 'adverts', label: 'WhatsApp', icon: '💬', categories: [AD], subs: ['WhatsApp adverts'] },
  cuttings: { areaKey: 'finance', label: 'Cuttings', icon: '✂️', categories: ['Finance'], subs: ['Cuttings'] },
  video: { areaKey: 'adverts', label: 'Video', icon: '🎬', categories: [AD], subs: ['Video adverts'] },
  item_photos: { areaKey: 'adverts', label: 'Item Photos', icon: '📷', categories: [AD], subs: NONE },
  opener: { areaKey: 'staff', label: 'Opener', icon: '🌅', categories: [ST], subs: ['Opening and closing'], assign: 'opener' },
  closer: { areaKey: 'staff', label: 'Closer', icon: '🌙', categories: [ST], subs: ['Opening and closing'], assign: 'closer' },
}
