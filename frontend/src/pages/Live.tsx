import { useEffect } from 'react'
import { useLivePolling } from '../hooks/useLivePolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { WinProbTimeline } from '../components/charts/WinProbTimeline'
import { useQuery } from '@tanstack/react-query'
import { fetchTeams } from '../api'
import { formatLocalTime } from '../utils/time'
import type { MatchStats } from '../api/types'

function ProbBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-xs text-slate-400">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{(value * 100).toFixed(0)}%</div>
    </div>
  )
}

function StatRow({
  label, home, away, higherIsBetter = true, format = (v: number) => String(v),
}: {
  label: string
  home: number | null
  away: number | null
  higherIsBetter?: boolean
  format?: (v: number) => string
}) {
  if (home == null && away == null) return null
  const h = home ?? 0, a = away ?? 0
  const homeWins = higherIsBetter ? h > a : h < a
  const awayWins = higherIsBetter ? a > h : a < h
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      {/* Home value */}
      <div className="text-right font-semibold" style={{ color: homeWins ? '#5b8fd4' : '#64748b' }}>
        {home != null ? format(home) : '–'}
      </div>
      {/* Label */}
      <div className="text-center text-[11px] text-slate-400 whitespace-nowrap px-2">{label}</div>
      {/* Away value */}
      <div className="font-semibold" style={{ color: awayWins ? '#c41230' : '#64748b' }}>
        {away != null ? format(away) : '–'}
      </div>
    </div>
  )
}

function PossessionBar({ home, away }: { home: number | null; away: number | null }) {
  if (home == null || away == null) return null
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-slate-400 text-center">Possession</div>
      <div className="flex h-4 rounded-full overflow-hidden text-[10px] font-bold">
        <div
          className="flex items-center justify-end pr-1.5 text-white transition-all"
          style={{ width: `${home}%`, backgroundColor: '#003087' }}
        >
          {home > 15 ? `${home}%` : ''}
        </div>
        <div
          className="flex items-center pl-1.5 text-white transition-all"
          style={{ width: `${away}%`, backgroundColor: '#c41230' }}
        >
          {away > 15 ? `${away}%` : ''}
        </div>
      </div>
    </div>
  )
}

function MatchStatsPanel({ stats, home, away }: { stats: MatchStats; home: string; away: string }) {
  const h = stats.home
  const a = stats.away
  return (
    <div className="rounded-lg px-4 py-3 space-y-3"
      style={{ backgroundColor: '#0f2040', border: '1px solid rgba(91,143,212,0.15)' }}>
      {/* Team labels */}
      <div className="grid grid-cols-[1fr_auto_1fr] text-[11px] font-bold uppercase tracking-wide">
        <div className="text-right" style={{ color: '#5b8fd4' }}>{home}</div>
        <div className="px-2 text-slate-500">Stats</div>
        <div style={{ color: '#c41230' }}>{away}</div>
      </div>

      <PossessionBar home={h.possession} away={a.possession} />

      <div className="space-y-1.5 pt-1">
        <StatRow label="Shots on target" home={h.shots_on_target} away={a.shots_on_target} />
        <StatRow label="Total shots" home={h.total_shots} away={a.total_shots} />
        {(h.xg != null || a.xg != null) && (
          <StatRow label="xG" home={h.xg} away={a.xg}
            format={v => v.toFixed(2)} />
        )}
        <StatRow label="Saves" home={h.saves} away={a.saves} />

        {/* Divider */}
        <div className="h-px my-1" style={{ background: 'rgba(91,143,212,0.1)' }} />

        <StatRow label="Passes" home={h.passes} away={a.passes} />
        {(h.passes_accurate != null || a.passes_accurate != null) && (
          <StatRow label="Accurate passes"
            home={h.passes_accurate} away={a.passes_accurate} />
        )}

        {/* Divider */}
        <div className="h-px my-1" style={{ background: 'rgba(91,143,212,0.1)' }} />

        <StatRow label="Corners" home={h.corners} away={a.corners} />
        <StatRow label="Fouls" home={h.fouls} away={a.fouls} higherIsBetter={false} />
        <StatRow label="Yellow cards" home={h.yellow_cards} away={a.yellow_cards} higherIsBetter={false}
          format={v => v > 0 ? `🟨 ${v}` : '0'} />
        {(h.red_cards != null && h.red_cards > 0) || (a.red_cards != null && a.red_cards > 0) ? (
          <StatRow label="Red cards" home={h.red_cards} away={a.red_cards} higherIsBetter={false}
            format={v => v > 0 ? `🟥 ${v}` : '0'} />
        ) : null}
      </div>
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

            // Upset alert: underdog's win probability has jumped ≥22pp vs prematch
            let upsetAlert: string | null = null
            if (m.live_probs && m.prematch) {
              const homeShift = m.live_probs.p_home - m.prematch.p_home
              const awayShift = m.live_probs.p_away - m.prematch.p_away
              if (homeShift >= 0.22 && m.prematch.p_home < m.prematch.p_away)
                upsetAlert = `${m.home} overturning (+${(homeShift * 100).toFixed(0)}pp vs prematch)`
              else if (awayShift >= 0.22 && m.prematch.p_away < m.prematch.p_home)
                upsetAlert = `${m.away} overturning (+${(awayShift * 100).toFixed(0)}pp vs prematch)`
            }

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

                {upsetAlert && (
                  <div className="bg-amber-500/20 border border-amber-500/40 rounded-lg px-3 py-2 text-center">
                    <span className="text-amber-300 font-semibold text-sm">⚡ UPSET IN PROGRESS — {upsetAlert}</span>
                  </div>
                )}

                {/* Live probabilities */}
                {m.live_probs && (
                  <div className="grid grid-cols-3 gap-2">
                    <ProbBadge label={`${m.home} win`} value={m.live_probs.p_home} color="#2563eb" />
                    <ProbBadge label="Draw" value={m.live_probs.p_draw} color="#9ca3af" />
                    <ProbBadge label={`${m.away} win`} value={m.live_probs.p_away} color="#dc2626" />
                  </div>
                )}

                {/* Live match stats from API-Football */}
                {m.match_stats && (
                  <MatchStatsPanel stats={m.match_stats} home={m.home} away={m.away} />
                )}

                {/* WPA timeline — shows from 1st poll onward */}
                {history.length >= 1 && (
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
                      {formatLocalTime(m.utc_date)}
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
