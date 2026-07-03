import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { ACCENT, type Accent } from './accents'

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  /** Lift + accent glow on hover */
  hover?: boolean
  accent?: Accent
}

export function GlassCard({ hover = false, accent = 'gold', className, children, style, ...rest }: GlassCardProps) {
  const glowStyle: CSSProperties | undefined = hover
    ? ({ '--glow': ACCENT[accent].glow, ...style } as CSSProperties)
    : style
  return (
    <div
      className={cn(
        'bg-[var(--glass-bg)] backdrop-blur-md border border-[var(--glass-border)] rounded-2xl',
        hover &&
          'transition-[transform,box-shadow,border-color] duration-200 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-[0_10px_40px_-10px_var(--glow)]',
        className,
      )}
      style={glowStyle}
      {...rest}
    >
      {children}
    </div>
  )
}

interface SectionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  title: ReactNode
  icon?: LucideIcon
  accent?: Accent
  actions?: ReactNode
}

export function SectionCard({ title, icon: Icon, accent = 'gold', actions, className, children, ...rest }: SectionCardProps) {
  return (
    <GlassCard className={cn('p-4 sm:p-5', className)} {...rest}>
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span
              className="w-7 h-7 rounded-lg grid place-items-center shrink-0"
              style={{ backgroundColor: ACCENT[accent].bg, color: ACCENT[accent].hex }}
            >
              <Icon size={15} strokeWidth={2.2} />
            </span>
          )}
          <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink-100 truncate">
            {title}
          </h3>
        </div>
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>
      {children}
    </GlassCard>
  )
}
