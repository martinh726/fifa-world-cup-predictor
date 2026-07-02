import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBacktestReport, fetchTeams, triggerRefresh } from '../../api'
import { useAppStore } from '../../store/useAppStore'
import { BrandArcPattern } from './BrandArcPattern'
import toast from 'react-hot-toast'

// ── Styled header inspired by the FIFA World Cup 2026 "26" graphic ──────────
function SidebarHeader() {
  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: 'var(--color-wc-blue)' }}>
      {/* Five-panel brand colour strip at top */}
      <div className="flex h-1.5">
        <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-blue)' }} />
        <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-lime)' }} />
        <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-green)' }} />
        <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-orange)' }} />
        <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-red)' }} />
      </div>

      {/* Logo content */}
      <div className="relative px-4 py-5 text-center">
        <BrandArcPattern
          variant="corner"
          opacity={0.22}
          className="absolute -top-4 -right-4 w-28 h-28 pointer-events-none"
        />

        {/* FIFA text */}
        <div
          className="relative text-xs font-black uppercase tracking-[0.35em] mb-0.5"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          FIFA
        </div>

        {/* WORLD CUP */}
        <div className="relative text-xl font-black tracking-wide text-white uppercase leading-none">
          World Cup
        </div>

        {/* 2026 — gradient sweep across the full brand palette */}
        <div
          className="relative text-5xl font-black tracking-tighter leading-none mt-0.5"
          style={{
            backgroundImage:
              'linear-gradient(90deg, var(--color-wc-lime), var(--color-wc-orange), var(--color-wc-gold-light))',
            WebkitBackgroundClip: 'text',
            backgroundClip: 'text',
            color: 'transparent',
            filter: 'drop-shadow(0 2px 6px rgba(0,0,0,0.15))',
          }}
        >
          2026
        </div>

        {/* Trophy emoji with glow */}
        <div className="relative text-2xl mt-1" style={{ filter: 'drop-shadow(0 0 6px rgba(201,150,42,0.7))' }}>
          🏆
        </div>

        {/* Predictor label */}
        <div
          className="relative text-[10px] uppercase tracking-[0.3em] mt-1.5 font-semibold"
          style={{ color: 'rgba(255,255,255,0.6)' }}
        >
          Predictor
        </div>

        {/* Five-panel brand colour strip at bottom */}
        <div className="relative flex h-1 mt-4 rounded-full overflow-hidden">
          <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-blue)' }} />
          <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-lime)' }} />
          <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-green)' }} />
          <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-orange)' }} />
          <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-red)' }} />
        </div>
      </div>
    </div>
  )
}

// ── Main sidebar ─────────────────────────────────────────────────────────────

export function Sidebar() {
  const { squadStrength, setSquadStrength, injuries, setInjury, clearInjuries } = useAppStore()
  const queryClient = useQueryClient()
  const [showReport, setShowReport] = useState(false)
  const [showInjuries, setShowInjuries] = useState(false)
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

  return (
    <aside className="w-64 flex-shrink-0 flex flex-col overflow-y-auto bg-white border-r border-slate-200">
      <SidebarHeader />

      <div className="flex flex-col gap-4 px-4 py-5 flex-1">
        {/* Squad strength */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
          <label className="text-xs font-semibold text-slate-600 block mb-2">
            Squad strength:{' '}
            <span className="font-bold" style={{ color: 'var(--color-wc-blue)' }}>
              {squadStrength.toFixed(2)}
            </span>
          </label>
          <input
            type="range"
            min={0} max={0.5} step={0.01}
            value={squadStrength}
            onChange={e => setSquadStrength(parseFloat(e.target.value))}
            className="w-full"
            style={{ accentColor: 'var(--color-wc-blue)' }}
          />
          <div className="flex justify-between text-xs text-slate-400 mt-0.5">
            <span>0.00</span><span>0.25</span><span>0.50</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Blends FIFA ranking + squad metrics. Default 0.18.
          </p>
        </div>

        <BrandArcPattern variant="divider" className="h-1 w-full" />

        {/* Injury overrides */}
        <div className="bg-slate-50 rounded-lg border border-slate-200 p-3">
          <button
            onClick={() => setShowInjuries(v => !v)}
            className="w-full text-left text-xs font-semibold text-slate-600 flex items-center justify-between transition-colors hover:text-slate-900"
          >
            <span>🤕 Injury overrides {activeInjuries.length > 0 ? `(${activeInjuries.length})` : ''}</span>
            <span className="text-slate-400">{showInjuries ? '▲' : '▼'}</span>
          </button>
          {showInjuries && (
            <div className="mt-2 space-y-2">
              <p className="text-xs text-slate-500">
                Reduce squad quality by marking key players absent.
              </p>
              <div className="flex gap-1">
                <select
                  value={injuryTeam}
                  onChange={e => setInjuryTeam(e.target.value)}
                  className="flex-1 rounded px-1 py-1 text-xs text-slate-800 bg-white border border-slate-300 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]"
                >
                  <option value="">Team…</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="number" min={1} max={5} value={injuryN}
                  onChange={e => setInjuryN(+e.target.value)}
                  className="w-12 rounded px-1 py-1 text-xs text-slate-800 bg-white border border-slate-300 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]"
                />
                <button
                  onClick={() => { if (injuryTeam) setInjury(injuryTeam, injuryN) }}
                  className="text-white rounded px-2 py-1 text-xs font-bold transition-opacity hover:opacity-90"
                  style={{ backgroundColor: 'var(--color-wc-red)' }}
                >
                  +
                </button>
              </div>
              {activeInjuries.length > 0 && (
                <div className="space-y-1">
                  {activeInjuries.map(([t, n]) => (
                    <div key={t} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{t}: {n} absent</span>
                      <button
                        onClick={() => setInjury(t, 0)}
                        className="text-[var(--color-wc-red)] hover:opacity-70"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  <button onClick={clearInjuries} className="text-xs text-slate-400 hover:text-slate-700">
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <BrandArcPattern variant="divider" className="h-1 w-full" />

        {/* Data refresh */}
        <div>
          <button
            onClick={() => doRefresh()}
            disabled={refreshing}
            className="w-full px-3 py-2 disabled:opacity-50 text-white text-sm rounded-lg font-bold uppercase tracking-wide transition-opacity hover:opacity-90 shadow-sm"
            style={{ backgroundColor: 'var(--color-wc-blue)' }}
          >
            {refreshing ? '⏳ Refreshing…' : '🔄 Refresh data'}
          </button>
          <p className="text-xs text-slate-500 mt-1">Re-fetches API data and rebuilds predictor.</p>
        </div>

        {/* Backtest report */}
        <div>
          <button
            onClick={() => setShowReport(v => !v)}
            className="w-full text-left text-xs font-semibold text-slate-600 flex items-center justify-between transition-colors hover:text-slate-900"
          >
            <span>📋 Backtest report</span>
            <span className="text-slate-400">{showReport ? '▲' : '▼'}</span>
          </button>
          {showReport && (
            <div className="mt-2">
              {reportData?.content ? (
                <pre className="text-xs text-slate-700 whitespace-pre-wrap rounded p-2 max-h-64 overflow-y-auto bg-slate-100 border border-slate-200">
                  {reportData.content}
                </pre>
              ) : (
                <div className="text-xs text-slate-500">
                  No backtest report found. Run the backtest script first.
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1" />

        {/* Footer */}
        <div className="text-center space-y-2">
          {/* Mini five-panel stripe */}
          <div className="flex h-0.5 rounded-full overflow-hidden opacity-60">
            <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-blue)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-lime)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-green)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-orange)' }} />
            <div className="flex-1" style={{ backgroundColor: 'var(--color-wc-red)' }} />
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-wider">
            FastAPI · React · 2026
          </div>
        </div>
      </div>
    </aside>
  )
}
