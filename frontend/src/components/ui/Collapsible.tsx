import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'
import { GlassCard } from './GlassCard'
import { ACCENT, type Accent } from './accents'

interface Props {
  title: ReactNode
  icon?: LucideIcon
  accent?: Accent
  defaultOpen?: boolean
  /** Extra element rendered right of the title (e.g. a count badge) */
  badge?: ReactNode
  children: ReactNode
  className?: string
}

export function Collapsible({
  title,
  icon: Icon,
  accent = 'gold',
  defaultOpen = false,
  badge,
  children,
  className,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <GlassCard className={cn('overflow-hidden', className)}>
      <button
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        className="w-full min-h-11 flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer transition-colors hover:bg-white/[0.05]"
      >
        <span className="flex items-center gap-2.5 min-w-0">
          {Icon && (
            <span
              className="w-6 h-6 rounded-md grid place-items-center shrink-0"
              style={{ backgroundColor: ACCENT[accent].bg, color: ACCENT[accent].hex }}
            >
              <Icon size={13} strokeWidth={2.2} />
            </span>
          )}
          <span className="font-display text-[13px] uppercase tracking-[0.14em] text-ink-100 truncate">
            {title}
          </span>
          {badge}
        </span>
        <ChevronDown
          size={16}
          className={cn('text-ink-400 shrink-0 transition-transform duration-200', open && 'rotate-180')}
        />
      </button>
      {open && <div className="px-4 pb-4 animate-rise">{children}</div>}
    </GlassCard>
  )
}
