'use client'

export function GMCBadge({ isGmc, size = 'small' }: { isGmc: boolean; size?: 'small' | 'medium' | 'large' }) {
  if (!isGmc) return null

  const styles = {
    small: 'w-4 h-4 text-[10px] font-bold',
    medium: 'w-5 h-5 text-xs font-bold',
    large: 'w-6 h-6 text-sm font-bold',
  }

  return (
    <span
      className={`${styles[size]} inline-flex items-center justify-center rounded-full bg-red-600 text-white ml-1 flex-shrink-0`}
      title="GMC Item"
    >
      G
    </span>
  )
}
