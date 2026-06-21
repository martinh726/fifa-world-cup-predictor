import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { fetchBacktestReport, fetchTeams, triggerRefresh } from '../../api'
import { useAppStore } from '../../store/useAppStore'
import toast from 'react-hot-toast'

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
    <aside className="w-64 flex-shrink-0 bg-slate-800 border-r border-slate-700 flex flex-col p-4 gap-5 overflow-y-auto">
      {/* Logo */}
      <div className="text-center">
        <div className="text-2xl font-bold text-white">⚽ WC 2026</div>
        <div className="text-xs text-slate-400 mt-0.5">Predictor</div>
      </div>

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
          className="w-full accent-blue-500"
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
                onClick={() => {
                  if (injuryTeam) setInjury(injuryTeam, injuryN)
                }}
                className="bg-blue-600 hover:bg-blue-500 text-white rounded px-2 py-1 text-xs"
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
          className="w-full px-3 py-2 bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-300 text-sm rounded-lg"
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

      <div className="text-xs text-slate-600 text-center">
        WC 2026 Predictor · FastAPI + React
      </div>
    </aside>
  )
}
