import { useEffect } from 'react'
import { useLivePolling } from '../hooks/useLivePolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { WinProbTimeline } from '../components/charts/WinProbTimeline'
import { useQuery } from '@tanstack/react-query'
import { fetchTeams } from '../api'

function ProbBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{(value * 100).toFixed(0)}%</div>
    </div>
  )
}

export function Live() {
  const { data, isLoading, dataUpdatedAt } = useLivePolling()
  const { appendWpaPoint, clearStaleWpaKeys, wpaHistory } = useAppStore()
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const flags = teamsData?.flags ?? {}

  const matches = data?.matches ?? []
  const upcoming = data?.todays_upcoming ?? []

  // Append WPA points from live data
  useEffect(() => {
    if (!matches.length) return
    const activeKeys = matches.map(m => `${m.home}v${m.away}`)
    clearStaleWpaKeys(activeKeys)
    for (const m of matches) {
      if (!m.live_probs) continue
      const key = `${m.home}v${m.away}`
      appendWpaPoint(key, {
        minute: m.minute,
        p_home: m.live_probs.p_home,
        p_draw: m.live_probs.p_draw,
        p_away: m.live_probs.p_away,
      })
    }
  }, [dataUpdatedAt])

  const age = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : null

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>Auto-refreshes every 30s{age !== null ? ` · updated ${age}s ago` : ''}</span>
        {data?.error && <span className="text-yellow-400">⚠️ {data.error}</span>}
      </div>

      {isLoading && !data && (
        <div className="text-slate-400 text-sm">Loading live data…</div>
      )}

      {/* Live matches */}
      {matches.length > 0 ? (
        <>
          <h3 className="text-slate-200 font-semibold">{matches.length} match{matches.length > 1 ? 'es' : ''} in progress</h3>
          {matches.map(m => {
            const key = `${m.home}v${m.away}`
            const history = wpaHistory[key] ?? []
            const isHT = m.status === 'PAUSED'
            const isPens = m.status === 'PENALTY_SHOOTOUT'
            const minLabel = isHT ? 'HT' : isPens ? 'Pens' : m.minute_estimated ? `~${m.minute}'` : `${m.minute}'`

            return (
              <div key={key} className="bg-slate-800 rounded-xl p-5 space-y-4">
                {/* Score row */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FlagImage code={flags[m.home]} size={28} alt={m.home} />
                    <span className="text-lg font-bold text-white">{m.home}</span>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold font-mono text-white">
                      {m.score_home} – {m.score_away}
                    </div>
                    <div className="text-xs text-amber-400 font-semibold">{minLabel}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-white">{m.away}</span>
                    <FlagImage code={flags[m.away]} size={28} alt={m.away} />
                  </div>
                </div>

                {/* Live probabilities */}
                {m.live_probs && (
                  <div className="grid grid-cols-3 gap-2">
                    <ProbBadge label={`${m.home} win`} value={m.live_probs.p_home} color="#2563eb" />
                    <ProbBadge label="Draw" value={m.live_probs.p_draw} color="#9ca3af" />
                    <ProbBadge label={`${m.away} win`} value={m.live_probs.p_away} color="#dc2626" />
                  </div>
                )}

                {/* WPA timeline */}
                {history.length >= 2 && (
                  <WinProbTimeline points={history} home={m.home} away={m.away} />
                )}

                {/* Pre-match prediction */}
                {m.prematch && (
                  <details>
                    <summary className="text-xs text-slate-400 cursor-pointer hover:text-slate-300">
                      Pre-match prediction
                    </summary>
                    <div className="mt-2 flex gap-4 text-sm">
                      <span className="text-blue-400">{m.home} {(m.prematch.p_home * 100).toFixed(0)}%</span>
                      <span className="text-slate-400">Draw {(m.prematch.p_draw * 100).toFixed(0)}%</span>
                      <span className="text-red-400">{m.away} {(m.prematch.p_away * 100).toFixed(0)}%</span>
                      <span className="text-slate-500">
                        xG {m.prematch.lambda_home?.toFixed(2)} – {m.prematch.lambda_away?.toFixed(2)}
                      </span>
                    </div>
                  </details>
                )}
              </div>
            )
          })}
        </>
      ) : (
        <>
          {/* Today's upcoming matches */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-slate-200 font-semibold">Today's upcoming matches</h3>
              {upcoming.map((m, i) => (
                <div key={i} className="bg-slate-800 rounded-xl p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <FlagImage code={flags[m.home]} size={24} alt={m.home} />
                      <span className="font-semibold text-white">{m.home}</span>
                      <span className="text-slate-400">vs</span>
                      <FlagImage code={flags[m.away]} size={24} alt={m.away} />
                      <span className="font-semibold text-white">{m.away}</span>
                    </div>
                    <div className="text-slate-400 text-sm">
                      {m.utc_date ? m.utc_date.slice(11, 16) + ' UTC' : ''}
                    </div>
                  </div>
                  {m.prediction && (
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="text-blue-400 font-semibold">{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-slate-400">{(m.prediction.p_draw * 100).toFixed(0)}%</span>
                      <span className="text-red-400 font-semibold">{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {!isLoading && upcoming.length === 0 && (
            <div className="bg-slate-800 rounded-xl p-6 text-center text-slate-400">
              <div className="text-3xl mb-2">⏸</div>
              <div>No matches currently in progress or scheduled today.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
