import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { GlassCard } from './GlassCard'
import { ACCENT, type Accent } from './accents'

interface Props {
  label: ReactNode
  value: ReactNode
  sub?: ReactNode
  accent?: Accent
  /** Explicit value color (overrides accent) — kept for legacy MetricCard call sites */
  valueColor?: string
  icon?: LucideIcon
  className?: string
}

export function StatCard({ label, value, sub, accent = 'neutral', valueColor, icon: Icon, className }: Props) {
  const color = valueColor ?? (accent === 'neutral' ? 'var(--color-ink-50)' : ACCENT[accent].hex)
  return (
    <GlassCard hover accent={accent} className={cn('relative overflow-hidden p-4 pl-5', className)}>
      {/* Accent bar */}
      <span
        className="absolute left-0 top-0 bottom-0 w-1"
        style={{ backgroundColor: accent === 'neutral' ? 'var(--color-ink-600)' : ACCENT[accent].hex }}
        aria-hidden="true"
      />
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400">{label}</span>
        {Icon && <Icon size={14} className="text-ink-500 shrink-0 mt-0.5" />}
      </div>
      <div className="font-display text-3xl leading-tight mt-1.5 tracking-wide" style={{ color }}>
        {value}
      </div>
      {sub && <div className="text-xs text-ink-400 mt-1">{sub}</div>}
    </GlassCard>
  )
}
