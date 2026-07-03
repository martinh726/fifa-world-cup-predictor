import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Loader2 } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '../../utils/cn'

type Variant = 'primary' | 'blue' | 'secondary' | 'ghost' | 'danger'
type Size = 'sm' | 'md'

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
  icon?: LucideIcon
  children?: ReactNode
}

const VARIANTS: Record<Variant, string> = {
  primary:
    'bg-host-red text-white font-bold uppercase tracking-wider hover:shadow-[0_0_24px_rgba(230,29,37,0.4)] hover:scale-[1.03] active:scale-[0.98] border border-transparent',
  blue:
    'bg-host-blue-bright text-white font-bold uppercase tracking-wider hover:shadow-[0_0_24px_rgba(61,82,196,0.45)] hover:scale-[1.03] active:scale-[0.98] border border-transparent',
  secondary:
    'bg-white/[0.06] text-ink-100 font-semibold border border-[var(--glass-border)] hover:bg-white/[0.10] hover:border-white/20 active:scale-[0.98]',
  ghost:
    'bg-transparent text-ink-300 font-semibold border border-transparent hover:bg-white/[0.06] hover:text-ink-50',
  danger:
    'bg-transparent text-host-red font-semibold border border-host-red/30 hover:bg-host-red/10 hover:border-host-red/60 active:scale-[0.98]',
}

const SIZES: Record<Size, string> = {
  sm: 'text-xs px-3 py-1.5 rounded-lg gap-1.5 min-h-8',
  md: 'text-sm px-5 py-2.5 rounded-xl gap-2 min-h-11',
}

export function Button({
  variant = 'secondary',
  size = 'md',
  loading = false,
  icon: Icon,
  className,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      className={cn(
        'inline-flex items-center justify-center select-none cursor-pointer',
        'transition-[transform,box-shadow,background-color,border-color,color] duration-200',
        'disabled:opacity-40 disabled:pointer-events-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? (
        <Loader2 size={size === 'sm' ? 13 : 15} className="animate-spin" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 13 : 15} strokeWidth={2.4} />
      )}
      {children}
    </button>
  )
}
