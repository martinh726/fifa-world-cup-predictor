import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

interface Props {
  title: ReactNode
  kicker?: string
  subtitle?: ReactNode
  icon?: LucideIcon
  actions?: ReactNode
}

export function PageHeader({ title, kicker = 'FIFA World Cup 26™', subtitle, icon: Icon, actions }: Props) {
  return (
    <header>
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.35em] font-semibold text-gold">
            {Icon && <Icon size={13} strokeWidth={2.4} />}
            <span>{kicker}</span>
          </div>
          <h1 className="font-display text-4xl md:text-5xl uppercase tracking-wide text-ink-50 leading-[0.95] mt-2">
            {title}
          </h1>
          {subtitle && <p className="text-sm text-ink-400 mt-2.5 max-w-xl">{subtitle}</p>}
        </div>
        {actions && <div className="flex items-center gap-3 pb-1.5">{actions}</div>}
      </div>
      {/* Asymmetric host-nation rule */}
      <div className="flex items-center gap-1.5 mt-4" aria-hidden="true">
        <span className="h-[3px] w-14 rounded-full bg-host-red" />
        <span className="h-[3px] w-7 rounded-full bg-host-blue-bright" />
        <span className="h-[3px] w-3.5 rounded-full bg-host-green" />
      </div>
    </header>
  )
}
