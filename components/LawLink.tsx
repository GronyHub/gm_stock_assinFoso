// "Read the law behind this" for a prompt. Opens Company Laws on the right tile in a NEW tab, so a prompt that must be answered is not lost.
export default function LawLink({ tile = 'staff', name }: { tile?: string; name: string }) {
  return <a href={`/laws?tile=${tile}`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs font-bold text-blue-700 underline">Read the law behind this: {name} ↗</a>
}
