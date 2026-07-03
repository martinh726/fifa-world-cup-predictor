import { ChevronDown } from 'lucide-react'
import { FlagImage } from './FlagImage'

interface Props {
  teams: string[]
  flags: Record<string, string>
  value: string
  onChange: (v: string) => void
  label?: string
  className?: string
}

export function TeamSelect({ teams, flags, value, onChange, label, className = '' }: Props) {
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400">{label}</label>
      )}
      <div className="relative flex items-center">
        <div className="absolute left-3 pointer-events-none">
          <FlagImage code={flags[value]} size={20} alt={value} />
        </div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full min-h-11 bg-white/[0.05] border border-[var(--glass-border)] rounded-xl pl-10 pr-9 py-2.5 text-ink-50 text-sm transition-colors focus:outline-none focus:border-gold/60 focus:ring-2 focus:ring-gold/15 hover:border-white/20 appearance-none cursor-pointer"
        >
          {teams.map(t => (
            <option key={t} value={t} className="bg-ink-900 text-ink-50">{t}</option>
          ))}
        </select>
        <ChevronDown size={15} className="absolute right-3 pointer-events-none text-ink-400" />
      </div>
    </div>
  )
}
