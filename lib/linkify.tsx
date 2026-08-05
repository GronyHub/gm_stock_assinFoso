// Detects http(s)/www links anywhere inside a longer block of text (not
// just when the whole value is a bare URL) and renders just those portions
// as clickable links, everything else as normal text. Shared by every
// free-text notes field in the app that might have a link pasted into the
// middle of a longer note (e.g. "please use this link: https://gov.uk/...
// thank you") -- see SubmenuTable.tsx, where this was first built.
const URL_PATTERN = /(https?:\/\/[^\s<>"')\]]+|www\.[^\s<>"')\]]+)/gi

export function containsUrl(v: string): boolean {
  URL_PATTERN.lastIndex = 0
  return URL_PATTERN.test(v)
}

function toHref(v: string): string {
  return /^https?:\/\//i.test(v) ? v : `https://${v}`
}

// Trailing sentence punctuation right after a URL (a period ending the
// sentence, a closing paren, etc.) is peeled off the link itself so it
// doesn't get swallowed into the href.
function linkifySegments(text: string): { text: string; url?: string }[] {
  const segments: { text: string; url?: string }[] = []
  let lastIndex = 0
  URL_PATTERN.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = URL_PATTERN.exec(text)) !== null) {
    if (match.index > lastIndex) segments.push({ text: text.slice(lastIndex, match.index) })
    let url = match[0]
    const trailing = url.match(/[.,;:!?)\]]+$/)?.[0] ?? ''
    if (trailing) url = url.slice(0, -trailing.length)
    segments.push({ text: url, url })
    if (trailing) segments.push({ text: trailing })
    lastIndex = match.index + match[0].length
  }
  if (lastIndex < text.length) segments.push({ text: text.slice(lastIndex) })
  return segments
}

// Drop-in text renderer -- wraps children in the given element type (span
// by default) and auto-links any URLs found inside. Renders nothing
// special (just the plain text) when there's no link in it, so it's safe
// to use unconditionally in place of `{text}`.
export function Linkify({ text, as: As = 'span', className, linkClassName = 'text-blue-600 underline break-all' }: {
  text: string
  as?: 'span' | 'p' | 'div'
  className?: string
  linkClassName?: string
}) {
  if (!containsUrl(text)) return <As className={className}>{text}</As>
  return (
    <As className={className}>
      {linkifySegments(text).map((seg, i) => seg.url ? (
        <a key={i} href={toHref(seg.url)} target="_blank" rel="noopener noreferrer" className={linkClassName}
          onClick={e => e.stopPropagation()}>{seg.text}</a>
      ) : <span key={i}>{seg.text}</span>)}
    </As>
  )
}
