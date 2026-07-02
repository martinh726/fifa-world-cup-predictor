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
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-sm text-slate-400">{label}</label>}
      <div className="relative flex items-center">
        <div className="absolute left-2 pointer-events-none">
          <FlagImage code={flags[value]} size={20} alt={value} />
        </div>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          className="w-full bg-white border border-slate-300 rounded-lg pl-9 pr-3 py-2 text-slate-800 text-sm transition-colors focus:outline-none focus:border-[var(--color-wc-blue)] focus:ring-2 focus:ring-[var(--color-wc-blue)]/15 appearance-none cursor-pointer"
        >
          {teams.map(t => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div className="absolute right-2 pointer-events-none text-slate-400 text-xs">▼</div>
      </div>
    </div>
  )
}
