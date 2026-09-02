'use client'

export function HelpButton({ onClick, className = '' }: { onClick: () => void; className?: string }) {
  return (
    <button
      onClick={onClick}
      title="Open help guide"
      aria-label="Help"
      className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold text-gray-600 hover:text-blue-600 transition ${className}`}
    >
      ❓ Help
    </button>
  )
}
