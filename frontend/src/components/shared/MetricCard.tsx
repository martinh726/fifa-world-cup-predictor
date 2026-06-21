interface Props {
  label: string
  value: string | number
  sub?: string
  color?: string
}

export function MetricCard({ label, value, sub, color }: Props) {
  return (
    <div className="bg-slate-800 rounded-lg p-3 flex flex-col gap-1">
      <span className="text-xs text-slate-400">{label}</span>
      <span className="text-xl font-bold" style={{ color: color ?? '#e2e8f0' }}>{value}</span>
      {sub && <span className="text-xs text-slate-500">{sub}</span>}
    </div>
  )
}
