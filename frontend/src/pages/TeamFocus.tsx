import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTeam, fetchTeams } from '../api'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { SingleTeamOddsBar } from '../components/charts/ChampionshipOddsBar'
import { MetricCard } from '../components/shared/MetricCard'

const STAGE_LABELS: Record<string, string> = {
  'P(R32)': 'Round of 32', 'P(R16)': 'Round of 16',
  'P(QF)': 'Quarter-final', 'P(SF)': 'Semi-final',
  'P(Final)': 'Final', 'P(Champion)': 'Champion',
}

export function TeamFocus() {
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const teams = teamsData?.teams ?? []
  const flags = teamsData?.flags ?? {}

  const { lastSimResult } = useAppStore()
  const [selectedTeam, setSelectedTeam] = useState('Argentina')

  const { data, isLoading, error } = useQuery({
    queryKey: ['team', selectedTeam],
    queryFn: () => fetchTeam(selectedTeam),
    enabled: !!selectedTeam,
    staleTime: 60_000,
  })

  const odds: Record<string, number> | null = (() => {
    if (data?.championship_odds) return data.championship_odds
    if (!lastSimResult) return null
    const row = lastSimResult.summary.find(r => r.team === selectedTeam)
    if (!row) return null
    return {
      'P(R32)': row['P(R32)'], 'P(R16)': row['P(R16)'],
      'P(QF)': row['P(QF)'], 'P(SF)': row['P(SF)'],
      'P(Final)': row['P(Final)'], 'P(Champion)': row['P(Champion)'],
    }
  })()

  return (
    <div className="space-y-5">
      {/* Team selector */}
      <div>
        <label className="text-xs text-slate-400 block mb-1">Select team</label>
        <select
          value={selectedTeam}
          onChange={e => setSelectedTeam(e.target.value)}
          className="bg-slate-700 border border-slate-600 rounded px-3 py-2 text-sm text-white"
        >
          {teams.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      {isLoading && <div className="text-slate-400 text-sm">Loading team data…</div>}
      {error && <div className="text-red-400 text-sm">Failed to load team data</div>}

      {data && (
        <>
          {/* Hero header */}
          <div className="bg-slate-800 rounded-xl p-6 flex items-center gap-6">
            <FlagImage code={data.flag_code ?? flags[selectedTeam]} size={64} alt={data.team} />
            <div>
              <h2 className="text-3xl font-bold text-white">{data.team}</h2>
              <div className="text-slate-400 mt-1">
                Group {data.group} · Elo: <strong className="text-white">{data.elo?.toFixed(0) ?? '—'}</strong>
              </div>
              {!lastSimResult && (
                <div className="text-xs text-amber-400 mt-1">
                  Run a simulation on the Simulator tab to see championship odds.
                </div>
              )}
            </div>
          </div>

          {/* Championship odds */}
          {odds ? (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-2">
                Championship odds (from simulation)
              </h3>
              <div className="grid grid-cols-3 gap-3 mb-4">
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <MetricCard
                    key={key}
                    label={label}
                    value={`${((odds[key] ?? 0) * 100).toFixed(1)}%`}
                    color={key === 'P(Champion)' ? '#16a34a' : undefined}
                  />
                ))}
              </div>
              <SingleTeamOddsBar odds={odds} team={data.team} />
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-4 text-slate-400 text-sm text-center">
              Run a simulation to see championship odds for {data.team}.
            </div>
          )}

          {/* Group standing */}
          {data.group_standing.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Group {data.group} standings</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="text-left py-1">Team</th>
                    <th className="text-right py-1">P</th>
                    <th className="text-right py-1">W</th>
                    <th className="text-right py-1">Pts</th>
                    <th className="text-right py-1">GD</th>
                    <th className="text-right py-1">GF</th>
                  </tr>
                </thead>
                <tbody>
                  {data.group_standing.map(row => {
                    const isSelected = row.team === selectedTeam
                    return (
                      <tr
                        key={row.team}
                        className={`border-b border-slate-700/30 ${isSelected ? 'bg-blue-900/30 font-bold' : ''}`}
                      >
                        <td className="py-1.5">
                          <FlagImage code={flags[row.team]} size={14} />{' '}
                          <span className={isSelected ? 'text-blue-300' : 'text-slate-200'}>{row.team}</span>
                        </td>
                        <td className="text-right py-1.5 text-slate-400">{row.played}</td>
                        <td className="text-right py-1.5 text-slate-400">
                          {/* wins = (pts - draws) / 3 approx — just show pts */}
                          —
                        </td>
                        <td className="text-right py-1.5 text-white font-bold">{row.pts}</td>
                        <td className="text-right py-1.5 text-slate-300">{row.gd > 0 ? '+' : ''}{row.gd}</td>
                        <td className="text-right py-1.5 text-slate-300">{row.gf}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* WC 2026 results */}
          {data.wc2026_results.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">2026 WC results</h3>
              <div className="space-y-2">
                {data.wc2026_results.map((r, i) => {
                  const color = r.result === 'W' ? '#22c55e' : r.result === 'L' ? '#ef4444' : '#94a3b8'
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="font-bold w-6 text-center rounded text-xs" style={{ color }}>
                          {r.result}
                        </span>
                        <FlagImage code={flags[r.opponent]} size={16} />
                        <span className="text-slate-200">vs {r.opponent}</span>
                      </div>
                      <span className="font-mono text-white">{r.goals_for} – {r.goals_against}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Predicted bracket path */}
          {data.bracket_path && data.bracket_path.length > 0 && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Predicted bracket path (most-likely simulation)
              </h3>
              <div className="space-y-2">
                {data.bracket_path.map((step, i) => {
                  const won = step.winner === selectedTeam
                  return (
                    <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${won ? 'bg-green-900/30' : 'bg-slate-700/40'}`}>
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 text-xs w-16">{step.stage}</span>
                        {step.opponent ? (
                          <>
                            <span className="text-slate-400">vs</span>
                            <FlagImage code={flags[step.opponent]} size={16} />
                            <span className="text-slate-200">{step.opponent}</span>
                          </>
                        ) : (
                          <span className="text-slate-500 italic">TBD</span>
                        )}
                      </div>
                      <div className="text-right">
                        {step.win_prob !== null && (
                          <span className="text-xs text-slate-400 mr-2">
                            {(step.win_prob * 100).toFixed(0)}% win
                          </span>
                        )}
                        {step.winner ? (
                          <span className={`text-xs font-semibold ${won ? 'text-green-400' : 'text-red-400'}`}>
                            {won ? '✓ Advance' : `✗ ${step.winner} wins`}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Next match */}
          {data.next_match && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Next match</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <FlagImage code={flags[data.next_match.home]} size={28} />
                  <span className="font-bold text-white">{data.next_match.home}</span>
                  <span className="text-slate-400">vs</span>
                  <FlagImage code={flags[data.next_match.away]} size={28} />
                  <span className="font-bold text-white">{data.next_match.away}</span>
                </div>
                <div className="text-sm text-slate-400">
                  {data.next_match.utc_date
                    ? data.next_match.utc_date.slice(0, 16).replace('T', ' ') + ' UTC'
                    : ''}
                </div>
              </div>
              {data.next_match.prediction && (
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="text-blue-400 font-semibold">
                    {data.next_match.home} {(data.next_match.prediction.p_home * 100).toFixed(0)}%
                  </span>
                  <span className="text-slate-400">
                    Draw {(data.next_match.prediction.p_draw * 100).toFixed(0)}%
                  </span>
                  <span className="text-red-400 font-semibold">
                    {data.next_match.away} {(data.next_match.prediction.p_away * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
