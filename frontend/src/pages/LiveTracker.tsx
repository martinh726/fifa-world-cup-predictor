import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useResultsPolling } from '../hooks/useResultsPolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { BracketViewer } from '../components/bracket/BracketViewer'
import { useQuery } from '@tanstack/react-query'
import { fetchTeams, fetchSchedule } from '../api'
import type { ThirdPlaceTeam } from '../api/types'
import { formatLocalKickoff } from '../utils/time'

const STATUS_ICON = { through: '✅', eliminated: '❌', contention: '' } as Record<string, string>
const STATUS_COLOR = { through: '#22c55e', eliminated: '#ef4444', contention: '#f59e0b' } as Record<string, string>

function statusLabel(t: { status: string; message: string }) {
  if (t.status === 'through') return { icon: '✅', color: '#22c55e' }
  if (t.status === 'eliminated') return { icon: '❌', color: '#ef4444' }
  // In 2026 WC, 3rd place competes for best-third slot — use amber for the race
  if (t.message.includes('best-third')) return { icon: '🏅', color: '#f59e0b' }
  return { icon: '', color: '#94a3b8' }
}

export function LiveTracker() {
  const [autoRefresh, setAutoRefresh] = useState(true)
  const [showThirds, setShowThirds] = useState(false)
  const [showGoalStats, setShowGoalStats] = useState(false)
  const [showSchedule, setShowSchedule] = useState(false)

  const { data: results, isLoading, dataUpdatedAt } = useResultsPolling(autoRefresh)
  const { manualResults, addManualResult, clearManualResults } = useAppStore()
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const { data: scheduleData } = useQuery({
    queryKey: ['schedule'],
    queryFn: () => fetchSchedule(30),
    enabled: showSchedule,
    staleTime: 600_000,
  })
  const queryClient = useQueryClient()

  const flags = teamsData?.flags ?? {}
  const allTeams = teamsData?.teams ?? []
  const groups = teamsData?.groups ?? {}
  const groupOf = Object.fromEntries(Object.entries(groups).flatMap(([g, ts]) => ts.map(t => [t, g])))

  // Manual result form state
  const [mT1, setMT1] = useState(allTeams[0] ?? '')
  const [mT2, setMT2] = useState(allTeams[1] ?? '')
  const [mS1, setMS1] = useState(0)
  const [mS2, setMS2] = useState(0)

  const age = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : null

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-400">
          {autoRefresh ? `Auto-syncs every 5 min${age !== null ? ` · updated ${age}s ago` : ''}` : 'Auto-refresh off'}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-blue-500" />
            Auto-refresh
          </label>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['results'] })}
            className="text-xs px-3 py-1 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded"
          >
            🔄 Sync now
          </button>
        </div>
      </div>

      {isLoading && !results && <div className="text-slate-400 text-sm">Loading results…</div>}

      {results && (
        <>
          {/* Played matches */}
          {(results.group_results.length > 0 || results.ko_results.length > 0) && (
            <div className="bg-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-300 mb-3">
                Played 2026 World Cup matches ({results.group_results.length + results.ko_results.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-700">
                      <th className="text-left py-1">Grp</th>
                      <th className="text-right py-1">Team 1</th>
                      <th className="text-center py-1 px-2">Score</th>
                      <th className="text-left py-1">Team 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.group_results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-700/30">
                        <td className="py-1 text-slate-500">{r.group}</td>
                        <td className="py-1 text-right">
                          <FlagImage code={flags[r.team1]} size={14} />{' '}{r.team1}
                        </td>
                        <td className="py-1 text-center font-mono font-bold text-white">
                          {r.score1} – {r.score2}
                        </td>
                        <td className="py-1">
                          <FlagImage code={flags[r.team2]} size={14} />{' '}{r.team2}
                        </td>
                      </tr>
                    ))}
                    {results.ko_results.map((r, i) => (
                      <tr key={`ko-${i}`} className="border-b border-slate-700/30">
                        <td className="py-1 text-slate-500">KO</td>
                        <td className="py-1 text-right">{r.team1}</td>
                        <td className="py-1 text-center text-slate-400">→ {r.winner}</td>
                        <td className="py-1">{r.team2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Group standings */}
          {Object.keys(results.standings).length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-slate-300 mb-3">Current group standings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(results.standings).sort().map(([letter, group]) => (
                  <div key={letter} className="bg-slate-800 rounded-xl p-4">
                    <div className="font-bold text-slate-200 mb-2">Group {letter}</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-400 border-b border-slate-700">
                          <th className="text-left py-0.5">Team</th>
                          <th className="text-right py-0.5 px-1">P</th>
                          <th className="text-right py-0.5 px-1">W</th>
                          <th className="text-right py-0.5 px-1">Pts</th>
                          <th className="text-right py-0.5 px-1">GD</th>
                          <th className="text-right py-0.5 px-1">GF</th>
                          <th className="py-0.5 w-5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.teams.map(t => {
                          const { icon, color } = statusLabel(t)
                          return (
                            <tr key={t.team} className="border-b border-slate-700/30">
                              <td className="py-0.5">
                                <FlagImage code={flags[t.team]} size={12} />{' '}{t.team}
                              </td>
                              <td className="text-right py-0.5 px-1 text-slate-400">{t.played}</td>
                              <td className="text-right py-0.5 px-1 text-slate-300">{t.wins ?? 0}</td>
                              <td className="text-right py-0.5 px-1 font-bold text-white">{t.pts}</td>
                              <td className="text-right py-0.5 px-1 text-slate-300">{t.gd > 0 ? '+' : ''}{t.gd}</td>
                              <td className="text-right py-0.5 px-1 text-slate-300">{t.gf}</td>
                              <td className="text-center py-0.5">{icon}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                    {/* Scenarios — colour reflects 2026 WC advancement path */}
                    <div className="mt-2 space-y-0.5">
                      {group.teams.map(t => {
                        const { color } = statusLabel(t)
                        return (
                          <div key={t.team} className="text-xs" style={{ color }}>
                            <FlagImage code={flags[t.team]} size={10} />{' '}
                            <strong>{t.team}</strong> — {t.message}
                          </div>
                        )
                      })}
                    </div>
                    {/* Remaining fixtures */}
                    {group.remaining_fixtures.length > 0 && (
                      <div className="mt-2 text-xs text-slate-500">
                        Remaining: {group.remaining_fixtures.map(f => `${f.team1} vs ${f.team2}`).join(' · ')}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Third-place race */}
          <details open={showThirds} onToggle={e => setShowThirds((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700">
              🏅 Third-place race — best 8 advance to R32
            </summary>
            <ThirdPlaceTable thirds={results.third_place_race} flags={flags} />
          </details>

          {/* Goal stats */}
          <details open={showGoalStats} onToggle={e => setShowGoalStats((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700">
              ⚽ Tournament goal statistics
            </summary>
            <div className="mt-2 bg-slate-800 rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-400">Total goals</div>
                  <div className="text-2xl font-bold text-white">{results.goal_stats.total_goals}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Goals / game</div>
                  <div className="text-2xl font-bold text-white">{results.goal_stats.goals_per_game}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-400">Matches played</div>
                  <div className="text-2xl font-bold text-white">{results.goal_stats.games_played}</div>
                </div>
              </div>
              {results.goal_stats.top_scorers.length > 0 && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-300 mb-1">Top scoring teams</div>
                    {results.goal_stats.top_scorers.slice(0, 6).map(([t, g]) => (
                      <div key={t} className="py-0.5">
                        <FlagImage code={flags[t]} size={12} />{' '}{t} — <strong>{g}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-300 mb-1">Best defences</div>
                    {results.goal_stats.best_defences.slice(0, 6).map(([t, g]) => (
                      <div key={t} className="py-0.5">
                        <FlagImage code={flags[t]} size={12} />{' '}{t} — <strong>{g}</strong> against
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </details>

          {/* Schedule */}
          <details open={showSchedule} onToggle={e => setShowSchedule((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-300 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700">
              📅 Full match schedule
            </summary>
            <div className="mt-2 space-y-1">
              {(scheduleData?.matches ?? []).map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-slate-800 rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FlagImage code={flags[m.home]} size={14} />{' '}
                    <span className="font-semibold text-white">{m.home}</span>
                    <span className="text-slate-400">vs</span>
                    <FlagImage code={flags[m.away]} size={14} />{' '}
                    <span className="font-semibold text-white">{m.away}</span>
                    <span className="text-slate-500">{formatLocalKickoff(m.utc_date)}</span>
                  </div>
                  {m.prediction && (
                    <div className="flex gap-2 text-xs">
                      <span className="text-blue-400 font-bold">{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-slate-400">{(m.prediction.p_draw * 100).toFixed(0)}%</span>
                      <span className="text-red-400 font-bold">{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>

          {/* Live bracket */}
          <div className="bg-slate-800 rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-300 mb-3">🏟️ Live Bracket</h3>
            <BracketViewer type="live" />
          </div>
        </>
      )}

      {/* Manual result entry */}
      <div className="bg-slate-800 rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-300">Enter a result manually</h3>
        <p className="text-xs text-slate-400">Fallback for when the dataset hasn't updated yet. Manual results are locked into simulations.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-slate-400 block mb-1">Team 1</label>
            <select value={mT1} onChange={e => setMT1(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white">
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS1} onChange={e => setMS1(+e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded w-14 px-2 py-1 text-sm text-white" />
          </div>
          <span className="text-slate-400 mb-1">–</span>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS2} onChange={e => setMS2(+e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded w-14 px-2 py-1 text-sm text-white" />
          </div>
          <div>
            <label className="text-xs text-slate-400 block mb-1">Team 2</label>
            <select value={mT2} onChange={e => setMT2(e.target.value)}
              className="bg-slate-700 border border-slate-600 rounded px-2 py-1 text-sm text-white">
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={() => {
              if (mT1 === mT2) return
              if (groupOf[mT1] !== groupOf[mT2]) return
              addManualResult({ team1: mT1, team2: mT2, score1: mS1, score2: mS2 })
            }}
            className="px-4 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded text-sm"
          >
            Add result
          </button>
        </div>
        {manualResults.length > 0 && (
          <div className="space-y-1 text-xs">
            <div className="text-slate-400">{manualResults.length} manual result(s) active:</div>
            {manualResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-300">
                <span>{r.team1} {r.score1}–{r.score2} {r.team2}</span>
              </div>
            ))}
            <button onClick={clearManualResults} className="text-red-400 hover:text-red-300 text-xs">
              Clear all manual results
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ThirdPlaceTable({ thirds, flags }: { thirds: ThirdPlaceTeam[]; flags: Record<string, string> }) {
  if (!thirds.length) return <div className="mt-2 text-slate-400 text-sm p-3">No groups have started yet.</div>
  const top8 = thirds.slice(0, 8)
  const rest = thirds.slice(8)
  return (
    <div className="mt-2 bg-slate-800 rounded-xl p-4 space-y-3">
      <p className="text-xs text-slate-400">Top 8 third-place finishers advance to R32. FIFA 2026 ranking: Pts → GD → GF → Wins.</p>
      <ThirdTable rows={top8} flags={flags} label="Currently qualifying (top 8)" />
      {rest.length > 0 && <ThirdTable rows={rest} flags={flags} label="Below the cutoff" />}
    </div>
  )
}

function ThirdTable({ rows, flags, label }: { rows: ThirdPlaceTeam[]; flags: Record<string, string>; label: string }) {
  return (
    <div>
      <div className="text-xs font-semibold text-slate-300 mb-1">{label}</div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-slate-400 border-b border-slate-700">
            <th className="text-left py-0.5">Grp</th>
            <th className="text-left py-0.5">Team</th>
            <th className="text-right py-0.5 px-1">P</th>
            <th className="text-right py-0.5 px-1">W</th>
            <th className="text-right py-0.5 px-1">Pts</th>
            <th className="text-right py-0.5 px-1">GD</th>
            <th className="text-right py-0.5 px-1">GF</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.team} className="border-b border-slate-700/30">
              <td className="py-0.5 text-slate-500">{r.group}</td>
              <td className="py-0.5">
                <FlagImage code={flags[r.team]} size={12} />{' '}{r.team}
                {!r.group_done && <span className="text-slate-500 ml-1">({r.remaining} left)</span>}
              </td>
              <td className="text-right py-0.5 px-1 text-slate-400">{r.played}</td>
              <td className="text-right py-0.5 px-1 text-slate-300">{r.wins ?? 0}</td>
              <td className="text-right py-0.5 px-1 font-bold text-white">{r.pts}</td>
              <td className="text-right py-0.5 px-1 text-slate-300">{r.gd > 0 ? '+' : ''}{r.gd}</td>
              <td className="text-right py-0.5 px-1 text-slate-300">{r.gf}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
