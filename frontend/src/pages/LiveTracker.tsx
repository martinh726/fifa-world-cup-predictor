import { useState, useMemo, Fragment } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useResultsPolling } from '../hooks/useResultsPolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { BracketViewer } from '../components/bracket/BracketViewer'
import { useQuery } from '@tanstack/react-query'
import { fetchTeams, fetchSchedule } from '../api'
import type { ThirdPlaceTeam } from '../api/types'
import { formatLocalKickoff } from '../utils/time'

function statusLabel(t: { status: string; message: string }) {
  if (t.status === 'through') return { icon: '✅', color: 'var(--color-success)' }
  if (t.status === 'eliminated') return { icon: '❌', color: 'var(--color-danger)' }
  // In 2026 WC, 3rd place competes for best-third slot — use amber for the race
  if (t.message.includes('best-third')) return { icon: '🏅', color: 'var(--color-warning)' }
  return { icon: '', color: 'var(--color-slate-400)' }
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

  const snapshot = useMemo(() => {
    if (!results) return null
    let through = 0, eliminated = 0, contention = 0
    for (const g of Object.values(results.standings)) {
      for (const t of g.teams) {
        if (t.status === 'through') through++
        else if (t.status === 'eliminated') eliminated++
        else contention++
      }
    }
    return { through, eliminated, contention, groupGames: results.group_results.length }
  }, [results])

  const nextMatches = useMemo(() => {
    if (!scheduleData?.matches) return []
    return scheduleData.matches
      .filter(m => !['FINISHED', 'IN_PLAY', 'HALFTIME', 'PAUSED', 'EXTRA_TIME', 'PENALTY_SHOOTOUT'].includes(m.status))
      .slice(0, 5)
  }, [scheduleData])

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-xs text-slate-500">
          {autoRefresh ? `Auto-syncs every 5 min${age !== null ? ` · updated ${age}s ago` : ''}` : 'Auto-refresh off'}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
            <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
              className="w-4 h-4 accent-[var(--color-wc-blue)]" />
            Auto-refresh
          </label>
          <button
            onClick={() => queryClient.invalidateQueries({ queryKey: ['results'] })}
            className="text-xs px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded transition-colors"
          >
            🔄 Sync now
          </button>
        </div>
      </div>

      {isLoading && !results && <div className="text-slate-500 text-sm">Loading results…</div>}

      {/* Snapshot stats — visible as soon as any matches have been played */}
      {snapshot && (snapshot.through > 0 || snapshot.eliminated > 0) && (
        <div className="flex gap-3 flex-wrap">
          <div className="rounded-lg px-4 py-2 text-center border" style={{ backgroundColor: 'var(--color-success-bg)', borderColor: 'rgba(29,138,78,0.25)' }}>
            <div className="text-xs" style={{ color: 'var(--color-success)' }}>Qualified</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-success)' }}>{snapshot.through}</div>
          </div>
          <div className="rounded-lg px-4 py-2 text-center border" style={{ backgroundColor: 'var(--color-danger-bg)', borderColor: 'rgba(198,36,44,0.25)' }}>
            <div className="text-xs" style={{ color: 'var(--color-danger)' }}>Eliminated</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-danger)' }}>{snapshot.eliminated}</div>
          </div>
          <div className="rounded-lg px-4 py-2 text-center border" style={{ backgroundColor: 'var(--color-warning-bg)', borderColor: 'rgba(185,114,10,0.25)' }}>
            <div className="text-xs" style={{ color: 'var(--color-warning)' }}>In contention</div>
            <div className="text-2xl font-bold" style={{ color: 'var(--color-warning)' }}>{snapshot.contention}</div>
          </div>
          <div className="bg-white border border-slate-200 shadow-sm rounded-lg px-4 py-2 text-center">
            <div className="text-xs text-slate-500">Group games</div>
            <div className="text-2xl font-bold text-slate-900">
              {snapshot.groupGames}<span className="text-sm font-normal text-slate-400">/72</span>
            </div>
          </div>
        </div>
      )}

      {/* Next 5 upcoming matches — always visible, loaded independently */}
      {nextMatches.length > 0 && (
        <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
          <h3 className="text-sm font-semibold text-slate-700 mb-3">Next up</h3>
          <div className="space-y-2">
            {nextMatches.map((m, i) => (
              <div key={i} className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm">
                  <FlagImage code={flags[m.home]} size={18} alt={m.home} />
                  <span className="text-slate-900 font-medium">{m.home}</span>
                  <span className="text-slate-400 text-xs">vs</span>
                  <FlagImage code={flags[m.away]} size={18} alt={m.away} />
                  <span className="text-slate-900 font-medium">{m.away}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {m.prediction && (
                    <span>
                      <span className="font-medium" style={{ color: 'var(--color-wc-blue)' }}>{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-slate-400"> · {(m.prediction.p_draw * 100).toFixed(0)}% · </span>
                      <span className="font-medium" style={{ color: 'var(--color-wc-red)' }}>{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </span>
                  )}
                  <span className="text-slate-500">{formatLocalKickoff(m.utc_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {results && (
        <>
          {/* Played matches */}
          {(results.group_results.length > 0 || results.ko_results.length > 0) && (
            <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">
                Played 2026 World Cup matches ({results.group_results.length + results.ko_results.length})
              </h3>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200">
                      <th className="text-left py-1">Grp</th>
                      <th className="text-right py-1">Team 1</th>
                      <th className="text-center py-1 px-2">Score</th>
                      <th className="text-left py-1">Team 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.group_results.map((r, i) => (
                      <tr key={i} className="border-b border-slate-100">
                        <td className="py-1 text-slate-500">{r.group}</td>
                        <td className="py-1 text-right">
                          <FlagImage code={flags[r.team1]} size={14} />{' '}{r.team1}
                        </td>
                        <td className="py-1 text-center font-mono font-bold text-slate-900">
                          {r.score1} – {r.score2}
                        </td>
                        <td className="py-1">
                          <FlagImage code={flags[r.team2]} size={14} />{' '}{r.team2}
                        </td>
                      </tr>
                    ))}
                    {results.ko_results.map((r, i) => (
                      <tr key={`ko-${i}`} className="border-b border-slate-100">
                        <td className="py-1 text-slate-500">KO</td>
                        <td className="py-1 text-right">{r.team1}</td>
                        <td className="py-1 text-center text-slate-500">→ {r.winner}</td>
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
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Current group standings</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Object.entries(results.standings).sort().map(([letter, group]) => (
                  <div key={letter} className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
                    <div className="font-bold text-slate-900 mb-2">Group {letter}</div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-slate-500 border-b border-slate-200">
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
                          const { icon } = statusLabel(t)
                          return (
                            <tr key={t.team} className="border-b border-slate-100">
                              <td className="py-0.5">
                                <FlagImage code={flags[t.team]} size={12} />{' '}{t.team}
                              </td>
                              <td className="text-right py-0.5 px-1 text-slate-500">{t.played}</td>
                              <td className="text-right py-0.5 px-1 text-slate-700">{t.wins ?? 0}</td>
                              <td className="text-right py-0.5 px-1 font-bold text-slate-900">{t.pts}</td>
                              <td className="text-right py-0.5 px-1 text-slate-700">{t.gd > 0 ? '+' : ''}{t.gd}</td>
                              <td className="text-right py-0.5 px-1 text-slate-700">{t.gf}</td>
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
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg transition-colors hover:bg-slate-50">
              🏅 Third-place race — best 8 advance to R32
            </summary>
            <ThirdPlaceTable thirds={results.third_place_race} flags={flags} />
          </details>

          {/* Goal stats */}
          <details open={showGoalStats} onToggle={e => setShowGoalStats((e.target as HTMLDetailsElement).open)}>
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg transition-colors hover:bg-slate-50">
              ⚽ Tournament goal statistics
            </summary>
            <div className="mt-2 bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3">
              <div className="grid grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-xs text-slate-500">Total goals</div>
                  <div className="text-2xl font-bold text-slate-900">{results.goal_stats.total_goals}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Goals / game</div>
                  <div className="text-2xl font-bold text-slate-900">{results.goal_stats.goals_per_game}</div>
                </div>
                <div>
                  <div className="text-xs text-slate-500">Matches played</div>
                  <div className="text-2xl font-bold text-slate-900">{results.goal_stats.games_played}</div>
                </div>
              </div>
              {results.goal_stats.top_scorers.length > 0 && (
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Top scoring teams</div>
                    {results.goal_stats.top_scorers.slice(0, 6).map(([t, g]) => (
                      <div key={t} className="py-0.5">
                        <FlagImage code={flags[t]} size={12} />{' '}{t} — <strong>{g}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="font-semibold text-slate-700 mb-1">Best defences</div>
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
            <summary className="cursor-pointer text-sm font-semibold text-slate-700 bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg transition-colors hover:bg-slate-50">
              📅 Full match schedule
            </summary>
            <div className="mt-2 space-y-1">
              {(scheduleData?.matches ?? []).map((m, i) => (
                <div key={i} className="flex items-center justify-between bg-white border border-slate-200 shadow-sm rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FlagImage code={flags[m.home]} size={14} />{' '}
                    <span className="font-semibold text-slate-900">{m.home}</span>
                    <span className="text-slate-400">vs</span>
                    <FlagImage code={flags[m.away]} size={14} />{' '}
                    <span className="font-semibold text-slate-900">{m.away}</span>
                    <span className="text-slate-500">{formatLocalKickoff(m.utc_date)}</span>
                  </div>
                  {m.prediction && (
                    <div className="flex gap-2 text-xs">
                      <span className="font-bold" style={{ color: 'var(--color-wc-blue)' }}>{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-slate-400">{(m.prediction.p_draw * 100).toFixed(0)}%</span>
                      <span className="font-bold" style={{ color: 'var(--color-wc-red)' }}>{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </details>

          {/* Live bracket */}
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">🏟️ Live Bracket</h3>
            <BracketViewer type="live" />
          </div>
        </>
      )}

      {/* Manual result entry */}
      <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-4 space-y-3">
        <h3 className="text-sm font-semibold text-slate-700">Enter a result manually</h3>
        <p className="text-xs text-slate-500">Fallback for when the dataset hasn't updated yet. Manual results are locked into simulations.</p>
        <div className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="text-xs text-slate-500 block mb-1">Team 1</label>
            <select value={mT1} onChange={e => setMT1(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm text-slate-800 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]">
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS1} onChange={e => setMS1(+e.target.value)}
              className="bg-white border border-slate-300 rounded w-14 px-2 py-1 text-sm text-slate-800 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]" />
          </div>
          <span className="text-slate-500 mb-1">–</span>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS2} onChange={e => setMS2(+e.target.value)}
              className="bg-white border border-slate-300 rounded w-14 px-2 py-1 text-sm text-slate-800 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]" />
          </div>
          <div>
            <label className="text-xs text-slate-500 block mb-1">Team 2</label>
            <select value={mT2} onChange={e => setMT2(e.target.value)}
              className="bg-white border border-slate-300 rounded px-2 py-1 text-sm text-slate-800 transition-colors focus:outline-none focus:border-[var(--color-wc-blue)]">
              {allTeams.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <button
            onClick={() => {
              if (mT1 === mT2) return
              if (groupOf[mT1] !== groupOf[mT2]) return
              addManualResult({ team1: mT1, team2: mT2, score1: mS1, score2: mS2 })
            }}
            className="px-4 py-1 text-white rounded text-sm transition-opacity hover:opacity-90"
            style={{ backgroundColor: 'var(--color-wc-blue)' }}
          >
            Add result
          </button>
        </div>
        {manualResults.length > 0 && (
          <div className="space-y-1 text-xs">
            <div className="text-slate-500">{manualResults.length} manual result(s) active:</div>
            {manualResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-slate-700">
                <span>{r.team1} {r.score1}–{r.score2} {r.team2}</span>
              </div>
            ))}
            <button onClick={clearManualResults} className="text-xs transition-opacity hover:opacity-70" style={{ color: 'var(--color-danger)' }}>
              Clear all manual results
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function ThirdPlaceTable({ thirds, flags }: { thirds: ThirdPlaceTeam[]; flags: Record<string, string> }) {
  if (!thirds.length) return <div className="mt-2 text-slate-500 text-sm p-3">No groups have started yet.</div>
  return (
    <div className="mt-2 bg-white border border-slate-200 shadow-sm rounded-xl p-4">
      <p className="text-xs text-slate-500 mb-3">
        Top 8 advance to R32 · FIFA 2026: Pts → GD → GF · Lighter bar = max pts with remaining games
      </p>
      <div className="space-y-1.5">
        {thirds.map((r, idx) => {
          const isTop8 = idx < 8
          const maxPts = r.pts + 3 * r.remaining
          const barPct = (r.pts / 9) * 100
          const maxPct = Math.min((maxPts / 9) * 100, 100)
          return (
            <Fragment key={r.team}>
              {idx === 8 && (
                <div className="flex items-center gap-2 my-2">
                  <div className="flex-1 border-t border-dashed border-[var(--color-danger)]/40" />
                  <span className="text-xs whitespace-nowrap px-1" style={{ color: 'var(--color-danger)' }}>cutoff — top 8 advance</span>
                  <div className="flex-1 border-t border-dashed border-[var(--color-danger)]/40" />
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-400 w-5 text-right shrink-0">{idx + 1}</span>
                <span className="text-slate-500 w-4 shrink-0">{r.group}</span>
                <div className="flex items-center gap-1 w-28 shrink-0">
                  <FlagImage code={flags[r.team]} size={12} />
                  <span className={`truncate ${isTop8 ? 'text-slate-900 font-medium' : 'text-slate-500'}`}>{r.team}</span>
                </div>
                <div className="flex-1 relative h-4 bg-slate-200 rounded overflow-hidden">
                  {!r.group_done && maxPct > barPct && (
                    <div className="absolute inset-y-0 left-0 bg-slate-400/40 rounded" style={{ width: `${maxPct}%` }} />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${barPct}%`, backgroundColor: isTop8 ? 'var(--color-success)' : 'var(--color-slate-400)' }}
                  />
                </div>
                <span className={`font-bold w-6 text-right shrink-0 ${isTop8 ? 'text-slate-900' : 'text-slate-500'}`}>{r.pts}pt</span>
                <span className="text-slate-500 w-10 text-right shrink-0">{r.gd > 0 ? '+' : ''}{r.gd} GD</span>
                {!r.group_done && (
                  <span className="text-slate-400 w-8 text-right shrink-0 hidden sm:inline">+{r.remaining * 3}?</span>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
