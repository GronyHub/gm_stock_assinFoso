// A small dot after a clock time: green = clocked with the button, red = adjusted by hand.
export default function SourceDot({ source }: { source?: string | null }) {
  if (source === 'clock') return <span title="Clocked with the button" className="inline-block w-1.5 h-1.5 rounded-full bg-green-500 ml-1 align-middle" />
  if (source === 'manual') return <span title="Manually adjusted" className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 ml-1 align-middle" />
  return null
}
