import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBacktestReport, fetchTeams, triggerRefresh } from '../../api'
import { useAppStore } from '../../store/useAppStore'
import toast from 'react-hot-toast'

// ── Styled header inspired by the FOX/FIFA WC 2026 broadcast graphic ────────
function SidebarHeader() {
  return (
    <div className="relative overflow-hidden" style={{ backgroundColor: '#003087' }}>
      {/* Subtle star pattern overlay */}
      <div
        className="absolute inset-0 opacity-15"
        style={{
          backgroundImage:
            'radial-gradient(circle, #ffffff 1px, transparent 1px)',
          backgroundSize: '20px 20px',
        }}
      />

      {/* Three-panel colour strip at top */}
      <div className="flex h-1.5">
        <div className="flex-1" style={{ backgroundColor: '#c41230' }} />
        <div className="flex-1" style={{ backgroundColor: '#003087' }} />
        <div className="flex-1" style={{ backgroundColor: '#006633' }} />
      </div>

      {/* Logo content */}
      <div className="relative px-4 py-5 text-center">
        {/* Stars row */}
        <div className="flex justify-center gap-2 mb-2 text-xs" style={{ color: '#5b8fd4' }}>
          {'★ ★ ★ ★ ★'.split(' ').map((s, i) => (
            <span key={i}>{s}</span>
          ))}
        </div>

        {/* FIFA text */}
        <div
          className="text-xs font-black uppercase tracking-[0.35em] mb-0.5"
          style={{ color: '#a0bce0' }}
        >
          FIFA
        </div>

        {/* WORLD CUP */}
        <div className="text-xl font-black tracking-wide text-white uppercase leading-none">
          World Cup
        </div>

        {/* 2026 in gold */}
        <div
          className="text-5xl font-black tracking-tighter leading-none mt-0.5"
          style={{ color: '#c9a227', textShadow: '0 2px 8px rgba(201,162,39,0.4)' }}
        >
          2026
        </div>

        {/* Trophy emoji with glow */}
        <div className="text-2xl mt-1" style={{ filter: 'drop-shadow(0 0 6px rgba(201,162,39,0.6))' }}>
          🏆
        </div>

        {/* Predictor label */}
        <div
          className="text-[10px] uppercase tracking-[0.3em] mt-1.5 font-semibold"
          style={{ color: '#7090b8' }}
        >
          Predictor
        </div>

        {/* Three-panel colour strip at bottom */}
        <div className="flex h-1 mt-4 rounded-full overflow-hidden">
          <div className="flex-1" style={{ backgroundColor: '#c41230' }} />
          <div className="flex-1" style={{ backgroundColor: '#c9a227' }} />
          <div className="flex-1" style={{ backgroundColor: '#006633' }} />
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
    <aside
      className="w-64 flex-shrink-0 flex flex-col overflow-y-auto"
      style={{
        backgroundColor: '#09142a',
        borderRight: '1px solid rgba(201,162,39,0.15)',
      }}
    >
      <SidebarHeader />

      <div className="flex flex-col gap-5 px-4 py-5 flex-1">
        {/* Squad strength */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Squad strength:{' '}
            <span style={{ color: '#c9a227' }}>{squadStrength.toFixed(2)}</span>
          </label>
          <input
            type="range"
            min={0} max={0.5} step={0.01}
            value={squadStrength}
            onChange={e => setSquadStrength(parseFloat(e.target.value))}
            className="w-full"
            style={{ accentColor: '#c9a227' }}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>0.00</span><span>0.25</span><span>0.50</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Blends FIFA ranking + squad metrics. Default 0.18.
          </p>
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, #c41230, #003087, #006633)' }} />

        {/* Injury overrides */}
        <div>
          <button
            onClick={() => setShowInjuries(v => !v)}
            className="w-full text-left text-xs font-semibold text-slate-300 flex items-center justify-between"
          >
            <span>🤕 Injury overrides {activeInjuries.length > 0 ? `(${activeInjuries.length})` : ''}</span>
            <span className="text-slate-500">{showInjuries ? '▲' : '▼'}</span>
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
                  className="flex-1 rounded px-1 py-1 text-xs text-white"
                  style={{ backgroundColor: '#0f2040', border: '1px solid #1a3060' }}
                >
                  <option value="">Team…</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="number" min={1} max={5} value={injuryN}
                  onChange={e => setInjuryN(+e.target.value)}
                  className="w-12 rounded px-1 py-1 text-xs text-white"
                  style={{ backgroundColor: '#0f2040', border: '1px solid #1a3060' }}
                />
                <button
                  onClick={() => { if (injuryTeam) setInjury(injuryTeam, injuryN) }}
                  className="text-white rounded px-2 py-1 text-xs font-bold transition-opacity hover:opacity-80"
                  style={{ backgroundColor: '#c41230' }}
                >
                  +
                </button>
              </div>
              {activeInjuries.length > 0 && (
                <div className="space-y-1">
                  {activeInjuries.map(([t, n]) => (
                    <div key={t} className="flex items-center justify-between text-xs">
                      <span className="text-slate-300">{t}: {n} absent</span>
                      <button onClick={() => setInjury(t, 0)} className="text-red-400 hover:text-red-300">✕</button>
                    </div>
                  ))}
                  <button onClick={clearInjuries} className="text-xs text-slate-500 hover:text-slate-300">
                    Clear all
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Divider */}
        <div className="h-px" style={{ background: 'linear-gradient(90deg, #006633, #003087, #c41230)' }} />

        {/* Data refresh */}
        <div>
          <button
            onClick={() => doRefresh()}
            disabled={refreshing}
            className="w-full px-3 py-2 disabled:opacity-50 text-white text-sm rounded-lg font-bold uppercase tracking-wide transition-opacity hover:opacity-90"
            style={{ backgroundColor: '#c41230' }}
          >
            {refreshing ? '⏳ Refreshing…' : '🔄 Refresh data'}
          </button>
          <p className="text-xs text-slate-500 mt-1">Re-fetches API data and rebuilds predictor.</p>
        </div>

        {/* Backtest report */}
        <div>
          <button
            onClick={() => setShowReport(v => !v)}
            className="w-full text-left text-xs font-semibold text-slate-300 flex items-center justify-between"
          >
            <span>📋 Backtest report</span>
            <span className="text-slate-500">{showReport ? '▲' : '▼'}</span>
          </button>
          {showReport && (
            <div className="mt-2">
              {reportData?.content ? (
                <pre
                  className="text-xs text-slate-300 whitespace-pre-wrap rounded p-2 max-h-64 overflow-y-auto"
                  style={{ backgroundColor: '#050c1c', border: '1px solid #1a3060' }}
                >
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
          {/* Mini three-panel stripe */}
          <div className="flex h-0.5 rounded-full overflow-hidden opacity-50">
            <div className="flex-1" style={{ backgroundColor: '#c41230' }} />
            <div className="flex-1" style={{ backgroundColor: '#003087' }} />
            <div className="flex-1" style={{ backgroundColor: '#006633' }} />
          </div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            FastAPI · React · 2026
          </div>
        </div>
      </div>
    </aside>
  )
}
