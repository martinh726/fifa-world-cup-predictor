import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBacktestReport, fetchTeams, triggerRefresh } from '../../api'
import { useAppStore } from '../../store/useAppStore'
import toast from 'react-hot-toast'

// WC 2026 accent stripe colors
const STRIPE_COLORS = ['#c8102e', '#ea580c', '#f0a500', '#00b4d8', '#003da5', '#6b21a8']

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
    <aside className="w-64 flex-shrink-0 bg-slate-800 border-r border-slate-700/50 flex flex-col overflow-y-auto">
      {/* WC 2026 branded header */}
      <div className="px-4 pt-5 pb-4">
        {/* Rainbow accent stripe */}
        <div className="flex h-1 rounded-full overflow-hidden mb-4">
          {STRIPE_COLORS.map(c => (
            <div key={c} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>

        {/* Logo */}
        <div className="text-center">
          <div className="text-3xl font-black tracking-tight leading-none">
            <span style={{ color: '#c8102e' }}>FIFA</span>
            <span className="text-white"> WC</span>
          </div>
          <div
            className="text-4xl font-black tracking-tighter leading-none mt-0.5"
            style={{ color: '#f0a500' }}
          >
            2026
          </div>
          <div className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-1.5">
            Predictor
          </div>
        </div>

        {/* Bottom rainbow accent stripe */}
        <div className="flex h-0.5 rounded-full overflow-hidden mt-4 opacity-40">
          {STRIPE_COLORS.map(c => (
            <div key={c} className="flex-1" style={{ backgroundColor: c }} />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-5 px-4 pb-4 flex-1">
        {/* Squad strength */}
        <div>
          <label className="text-xs font-semibold text-slate-300 block mb-2">
            Squad strength: {squadStrength.toFixed(2)}
          </label>
          <input
            type="range"
            min={0} max={0.5} step={0.01}
            value={squadStrength}
            onChange={e => setSquadStrength(parseFloat(e.target.value))}
            className="w-full"
            style={{ accentColor: '#c8102e' }}
          />
          <div className="flex justify-between text-xs text-slate-500 mt-0.5">
            <span>0.00</span><span>0.25</span><span>0.50</span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Blends FIFA ranking + squad metrics. Default 0.18.
          </p>
        </div>

        {/* Injury overrides */}
        <div>
          <button
            onClick={() => setShowInjuries(v => !v)}
            className="w-full text-left text-xs font-semibold text-slate-300 flex items-center justify-between"
          >
            <span>🤕 Injury overrides {activeInjuries.length > 0 ? `(${activeInjuries.length})` : ''}</span>
            <span>{showInjuries ? '▲' : '▼'}</span>
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
                  className="flex-1 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-xs text-white"
                >
                  <option value="">Team…</option>
                  {teams.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
                <input
                  type="number" min={1} max={5} value={injuryN}
                  onChange={e => setInjuryN(+e.target.value)}
                  className="w-12 bg-slate-700 border border-slate-600 rounded px-1 py-1 text-xs text-white"
                />
                <button
                  onClick={() => { if (injuryTeam) setInjury(injuryTeam, injuryN) }}
                  className="text-white rounded px-2 py-1 text-xs"
                  style={{ backgroundColor: '#c8102e' }}
                  onMouseEnter={e => (e.currentTarget.style.backgroundColor = '#e0182e')}
                  onMouseLeave={e => (e.currentTarget.style.backgroundColor = '#c8102e')}
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

        {/* Data refresh */}
        <div>
          <button
            onClick={() => doRefresh()}
            disabled={refreshing}
            className="w-full px-3 py-2 disabled:opacity-50 text-white text-sm rounded-lg font-medium transition-colors"
            style={{ backgroundColor: refreshing ? '#666' : '#c8102e' }}
            onMouseEnter={e => { if (!refreshing) e.currentTarget.style.backgroundColor = '#e0182e' }}
            onMouseLeave={e => { if (!refreshing) e.currentTarget.style.backgroundColor = '#c8102e' }}
          >
            {refreshing ? '⏳ Refreshing…' : '🔄 Refresh live data'}
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
            <span>{showReport ? '▲' : '▼'}</span>
          </button>
          {showReport && (
            <div className="mt-2">
              {reportData?.content ? (
                <pre className="text-xs text-slate-300 whitespace-pre-wrap bg-slate-900 rounded p-2 max-h-64 overflow-y-auto">
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
        <div className="text-center">
          <div className="flex justify-center gap-1 mb-2">
            {STRIPE_COLORS.map(c => (
              <div key={c} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c }} />
            ))}
          </div>
          <div className="text-[10px] text-slate-600 uppercase tracking-wider">
            FastAPI + React
          </div>
        </div>
      </div>
    </aside>
  )
}
