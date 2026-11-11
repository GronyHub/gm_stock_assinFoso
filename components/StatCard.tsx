// One summary tile: label, big value, optional small line. The caller passes the colour classes (each screen has its own tone set).
export default function StatCard({ label, value, sub, cls }: { label: string; value: string; sub?: string; cls: string }) {
  return (
    <div className={`rounded-xl p-3 ${cls}`}>
      <p className="text-[10px] font-semibold opacity-70">{label}</p>
      <p className="text-lg font-bold">{value}</p>
      {sub && <p className="text-[9px] opacity-60 mt-0.5">{sub}</p>}
    </div>
  )
}
