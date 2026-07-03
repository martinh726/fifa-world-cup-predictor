import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { GlassCard } from './GlassCard'
import { BrandArcPattern } from '../shared/BrandArcPattern'

interface Props {
  icon: LucideIcon
  title: ReactNode
  hint?: ReactNode
  children?: ReactNode
  className?: string
}

export function EmptyState({ icon: Icon, title, hint, children, className }: Props) {
  return (
    <GlassCard className={cn('relative overflow-hidden p-8 sm:p-10 text-center', className)}>
      <BrandArcPattern variant="full" opacity={0.08} className="absolute inset-0 w-full h-full pointer-events-none" />
      <div className="relative flex flex-col items-center gap-3">
        <span className="w-14 h-14 rounded-2xl grid place-items-center bg-white/[0.05] border border-[var(--glass-border)] text-ink-400">
          <Icon size={26} strokeWidth={1.8} />
        </span>
        <div className="font-display text-lg uppercase tracking-[0.12em] text-ink-100">{title}</div>
        {hint && <p className="text-sm text-ink-400 max-w-sm">{hint}</p>}
        {children}
      </div>
    </GlassCard>
  )
}
