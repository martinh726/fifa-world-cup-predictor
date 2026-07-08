import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trophy, Users, ClipboardList, RefreshCw, Plus, X } from 'lucide-react'
import { fetchBacktestReport, fetchStatus, fetchTeams, triggerRefresh } from '../../api'
import { useAppStore } from '../../store/useAppStore'
import { BrandArcPattern } from './BrandArcPattern'
import { Button } from '../ui/Button'
import { Collapsible } from '../ui/Collapsible'
import toast from 'react-hot-toast'

// ── Logotype header — stacked Anton "26" in a gold sweep ────────────────────
function SidebarHeader() {
  return (
    <div className="relative overflow-hidden border-b border-white/[0.06]">
      {/* Host-nation hairline */}
      <div className="flex h-1" aria-hidden="true">
        <div className="flex-1 bg-host-red" />
        <div className="flex-1 bg-host-blue-bright" />
        <div className="flex-1 bg-host-green" />
      </div>

      <div className="relative px-4 pt-6 pb-5 text-center">
        <BrandArcPattern
          variant="corner"
          opacity={0.16}
          className="absolute -top-4 -right-4 w-28 h-28 pointer-events-none"
        />

        <div className="relative text-[10px] uppercase tracking-[0.42em] font-semibold text-ink-400">
          FIFA World Cup
        </div>

        <div
          className="relative font-display text-[76px] leading-none mt-1 bg-clip-text text-transparent select-none"
          style={{
            backgroundImage: 'linear-gradient(180deg, #E9CE7A 0%, #D4AF37 55%, #9A7B1E 100%)',
            filter: 'drop-shadow(0 3px 12px rgba(212,175,55,0.28))',
          }}
        >
          26
        </div>

        <div className="relative flex items-center justify-center gap-2 mt-2.5">
          <Trophy size={13} className="text-gold" strokeWidth={2.2} />
          <span className="text-[10px] uppercase tracking-[0.35em] font-semibold text-ink-300">
            Predictor
          </span>
        </div>
      </div>
    </div>
  )
}

// ── Data-source / model status indicator ────────────────────────────────────
function StatusIndicator() {
  const { data, isError } = useQuery({
    queryKey: ['status'],
    queryFn: fetchStatus,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  })

  const sources = data ? Object.values(data.sources) : []
  const anyFailed = isError || sources.some(s => !s.ok && !s.rate_limited)
  const degraded = !isError && (
    (data && !data.football_data_key) || sources.some(s => s.rate_limited)
  )
  const color = anyFailed ? 'bg-host-red' : degraded ? 'bg-gold' : 'bg-host-green'
  const label = isError
    ? 'API unreachable'
    : anyFailed
      ? 'Data feed error'
      : degraded
        ? (data && !data.football_data_key ? 'No API key' : 'Rate limited')
        : 'Live data OK'

  return (
    <div className="text-left bg-white/[0.04] rounded-xl border border-white/[0.07] px-3 py-2 space-y-1">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full flex-shrink-0 ${color}`} aria-hidden="true" />
        <span className="text-[11px] font-semibold text-ink-300">{label}</span>
      </div>
      {data?.data_through && (
        <div className="text-[10px] text-ink-500">Data through {data.data_through}</div>
      )}
      {data?.model.last_trained && (
        <div className="text-[10px] text-ink-500">
          Model trained {data.model.last_trained.slice(0, 10)}
        </div>
      )}
    </div>
  )
}

// ── Main sidebar — floating dark-glass rail ──────────────────────────────────

export function Sidebar({ onClose }: { onClose?: () => void }) {
  const { squadStrength, setSquadStrength, injuries, setInjury, clearInjuries } = useAppStore()
  const queryClient = useQueryClient()
  const [showReport, setShowReport] = useState(false)
  const [injuryTeam, setInjuryTeam] = useState('')
  const [injuryN, setInjuryN] = useState(1)

  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const teams = teamsData?.teams ?? []

  const { data: reportData } = useQuery({
    queryKey: ['backtest-report'],
    queryFn: fetchBacktestReport,
    enabled: showReport,
    staleTime: Infinity,
  })

  const { mutate: doRefresh, isPending: refreshing } = useMutation({
    mutationFn: triggerRefresh,
    onSuccess: (data) => {
      toast.success(`Data refreshed — through ${data.data_through}`)
      queryClient.invalidateQueries()
    },
    onError: () => toast.error('Refresh failed'),
  })

  const activeInjuries = Object.entries(injuries).filter(([, n]) => n > 0)

  const inputClass =
    'bg-white/[0.05] border border-[var(--glass-border)] rounded-lg text-ink-50 text-xs transition-colors focus:outline-none focus:border-gold/60'

  return (
    <aside className="border-beam relative w-64 h-full flex flex-col overflow-hidden rounded-2xl bg-ink-900/70 backdrop-blur-xl border border-[var(--glass-border)] shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]">
      {onClose && (
        <button
          onClick={onClose}
          className="absolute right-2 top-3 z-10 min-h-11 min-w-11 grid place-items-center text-ink-400 hover:text-ink-50 transition-colors cursor-pointer lg:hidden"
          aria-label="Close menu"
        >
          <X size={18} />
        </button>
      )}

      <SidebarHeader />

      <div className="flex flex-col gap-3.5 px-3.5 py-4 flex-1 overflow-y-auto">
        {/* Squad strength */}
        <div className="bg-white/[0.04] rounded-xl border border-white/[0.07] p-3">
          <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-400 block mb-2">
            Squad strength{' '}
            <span className="font-display text-sm text-gold tracking-normal ml-1">
              {squadStrength.toFixed(2)}
            </span>
          </label>
          <input
            type="range"
            min={0} max={0.5} step={0.01}
            value={squadStrength}
            onChange={e => setSquadStrength(parseFloat(e.target.value))}
            className="w-full cursor-pointer"
            style={{ accentColor: 'var(--color-gold)' }}
          />
          <div className="flex justify-between text-[10px] text-ink-500 mt-0.5">
            <span>0.00</span><span>0.25</span><span>0.50</span>
          </div>
          <p className="text-[11px] text-ink-400 mt-1.5 leading-relaxed">
            Blends FIFA ranking + squad metrics. Default 0.18.
          </p>
        </div>

        {/* Injury overrides */}
        <Collapsible
          title="Injuries"
          icon={Users}
          accent="red"
          badge={
            activeInjuries.length > 0 ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-host-red/20 text-host-red">
                {activeInjuries.length}
              </span>
            ) : undefined
          }
        >
          <div className="space-y-2.5">
            <p className="text-[11px] text-ink-400 leading-relaxed">
              Reduce squad quality by marking key players absent.
            </p>
            <div className="flex gap-1.5">
              <select
                value={injuryTeam}
                onChange={e => setInjuryTeam(e.target.value)}
                className={`flex-1 min-w-0 px-2 py-1.5 ${inputClass}`}
              >
                <option value="" className="bg-ink-900">Team…</option>
                {teams.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
              </select>
              <input
                type="number" min={1} max={5} value={injuryN}
                onChange={e => setInjuryN(+e.target.value)}
                className={`w-12 px-2 py-1.5 ${inputClass}`}
              />
              <Button
                variant="primary"
                size="sm"
                icon={Plus}
                aria-label="Add injury"
                onClick={() => { if (injuryTeam) setInjury(injuryTeam, injuryN) }}
              />
            </div>
            {activeInjuries.length > 0 && (
              <div className="space-y-1">
                {activeInjuries.map(([t, n]) => (
                  <div key={t} className="flex items-center justify-between text-xs">
                    <span className="text-ink-200">{t}: {n} absent</span>
                    <button
                      onClick={() => setInjury(t, 0)}
                      className="text-host-red hover:opacity-70 transition-opacity cursor-pointer p-1"
                      aria-label={`Remove ${t} injury`}
                    >
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button
                  onClick={clearInjuries}
                  className="text-[11px] text-ink-500 hover:text-ink-200 transition-colors cursor-pointer"
                >
                  Clear all
                </button>
              </div>
            )}
          </div>
        </Collapsible>

        {/* Data refresh */}
        <div>
          <Button
            variant="primary"
            className="w-full"
            icon={RefreshCw}
            loading={refreshing}
            onClick={() => doRefresh()}
          >
            {refreshing ? 'Refreshing…' : 'Refresh data'}
          </Button>
          <p className="text-[11px] text-ink-500 mt-1.5">Re-fetches API data and rebuilds predictor.</p>
        </div>

        {/* Backtest report */}
        <Collapsible title="Backtest report" icon={ClipboardList} accent="blue">
          {showReport ? (
            reportData?.content ? (
              <pre className="text-[11px] text-ink-200 whitespace-pre-wrap rounded-lg p-2.5 max-h-64 overflow-y-auto bg-ink-950/60 border border-white/[0.07]">
                {reportData.content}
              </pre>
            ) : (
              <div className="text-xs text-ink-400">
                No backtest report found. Run the backtest script first.
              </div>
            )
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setShowReport(true)}>
              Load report
            </Button>
          )}
        </Collapsible>

        <div className="flex-1" />

        {/* Footer */}
        <div className="text-center space-y-2.5 pb-1">
          <StatusIndicator />
          <div className="flex h-0.5 rounded-full overflow-hidden opacity-70" aria-hidden="true">
            <div className="flex-1 bg-host-red" />
            <div className="flex-1 bg-host-blue-bright" />
            <div className="flex-1 bg-host-green" />
          </div>
          <div className="text-[10px] text-ink-500 uppercase tracking-[0.25em]">
            FastAPI · React · 2026
          </div>
        </div>
      </div>
    </aside>
  )
}
