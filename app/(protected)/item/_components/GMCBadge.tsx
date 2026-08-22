'use client'

export function GMCBadge({ gmcType, size = 'small' }: { gmcType: string; size?: 'small' | 'medium' | 'large' }) {
  if (!gmcType) return null

  const styles = {
    small: 'w-4 h-4 text-[10px] font-bold',
    medium: 'w-5 h-5 text-xs font-bold',
    large: 'w-6 h-6 text-sm font-bold',
  }

  const badgeConfig: Record<string, { label: string; title: string; bgColor: string }> = {
    'gmc': { label: 'G', title: 'GMC only', bgColor: 'bg-red-600' },
    'service_gmc': { label: 'SG', title: 'Service & GMC', bgColor: 'bg-purple-600' },
    'service_using_gmc': { label: 'S→G', title: 'Service using GMC', bgColor: 'bg-blue-600' },
    'service_no_gmc': { label: 'S', title: 'Service only', bgColor: 'bg-gray-600' },
  }

  const config = badgeConfig[gmcType]
  if (!config) return null

  return (
    <span
      className={`${styles[size]} inline-flex items-center justify-center rounded-full ${config.bgColor} text-white ml-1 flex-shrink-0 text-[9px] sm:text-[10px] lg:text-[11px]`}
      title={config.title}
    >
      {config.label}
    </span>
  )
}
