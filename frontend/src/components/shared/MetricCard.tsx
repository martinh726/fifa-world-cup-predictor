import { StatCard } from '../ui/StatCard'

interface Props {
  label: string
  value: string | number
  sub?: string
  color?: string
}

/** Legacy wrapper — new code should use ui/StatCard directly. */
export function MetricCard({ label, value, sub, color }: Props) {
  return <StatCard label={label} value={value} sub={sub} valueColor={color} />
}
