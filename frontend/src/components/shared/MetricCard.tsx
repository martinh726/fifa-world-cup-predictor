interface Props {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function MetricCard({ label, value, sub, color }: Props) {
  return (
    <div className="bg-white rounded-lg p-3 flex flex-col gap-1 border border-slate-200 shadow-sm">
      <span className="text-xs text-slate-500">{label}</span>
      <span className="text-xl font-bold" style={{ color: color ?? 'var(--color-slate-800)' }}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
