import { useState, useMemo, Fragment } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  BarChart3, RefreshCw, Medal, Goal, CalendarDays, Trophy, CircleCheck, CircleX,
  ListOrdered, Pencil,
} from 'lucide-react'
import { useResultsPolling } from '../hooks/useResultsPolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { BracketViewer } from '../components/bracket/BracketViewer'
import { useQuery } from '@tanstack/react-query'
import { fetchTeams, fetchSchedule } from '../api'
import type { ThirdPlaceTeam } from '../api/types'
import { formatLocalKickoff } from '../utils/time'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard, SectionCard } from '../components/ui/GlassCard'
import { StatCard } from '../components/ui/StatCard'
import { Button } from '../components/ui/Button'
import { Collapsible } from '../components/ui/Collapsible'
import { CardSkeleton } from '../components/ui/Skeleton'
import { QueryError } from '../components/ui/QueryError'

function StatusIcon({ status, message }: { status: string; message: string }) {
  if (status === 'through') return <CircleCheck size={13} className="text-host-green inline" />
  if (status === 'eliminated') return <CircleX size={13} className="text-host-red inline" />
  // In 2026 WC, 3rd place competes for best-third slot — gold for the race
  if (message.includes('best-third')) return <Medal size={13} className="text-gold inline" />
  return null
}

function statusColor(t: { status: string; message: string }) {
  if (t.status === 'through') return 'var(--color-host-green)'
  if (t.status === 'eliminated') return 'var(--color-host-red)'
  if (t.message.includes('best-third')) return 'var(--color-gold)'
  return 'var(--color-ink-500)'
}

export function LiveTracker() {
  const [autoRefresh, setAutoRefresh] = useState(true)

  const { data: results, isLoading, isError, refetch, dataUpdatedAt } = useResultsPolling(autoRefresh)
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

  const inputClass =
    'bg-white/[0.05] border border-[var(--glass-border)] rounded-lg text-ink-50 text-sm transition-colors focus:outline-none focus:border-gold/60'

  return (
    <div className="stagger space-y-5">
      <PageHeader
        title="Tournament Tracker"
        icon={BarChart3}
        subtitle={autoRefresh ? `Auto-syncs every 5 min${age !== null ? ` · updated ${age}s ago` : ''}` : 'Auto-refresh off'}
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-ink-200 cursor-pointer">
              <input
                type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 cursor-pointer" style={{ accentColor: 'var(--color-gold)' }}
              />
              Auto-refresh
            </label>
            <Button
              variant="secondary" size="sm" icon={RefreshCw}
              onClick={() => queryClient.invalidateQueries({ queryKey: ['results'] })}
            >
              Sync now
            </Button>
          </>
        }
      />

      {isLoading && !results && <CardSkeleton lines={4} />}

      {isError && !results && <QueryError onRetry={() => refetch()} />}

      {/* Snapshot stats — visible as soon as any matches have been played */}
      {snapshot && (snapshot.through > 0 || snapshot.eliminated > 0) && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StatCard label="Qualified" value={snapshot.through} accent="green" icon={CircleCheck} />
          <StatCard label="Eliminated" value={snapshot.eliminated} accent="red" icon={CircleX} />
          <StatCard label="In contention" value={snapshot.contention} accent="gold" icon={Medal} />
          <StatCard
            label="Group games"
            value={<span>{snapshot.groupGames}<span className="text-base text-ink-400">/72</span></span>}
            accent="blue"
          />
        </div>
      )}

      {/* Next 5 upcoming matches */}
      {nextMatches.length > 0 && (
        <SectionCard icon={CalendarDays} accent="blue" title="Next up">
          <div className="space-y-2.5">
            {nextMatches.map((m, i) => (
              <div key={i} className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm">
                  <FlagImage code={flags[m.home]} size={18} alt={m.home} />
                  <span className="text-ink-50 font-medium">{m.home}</span>
                  <span className="text-ink-500 text-xs uppercase">vs</span>
                  <FlagImage code={flags[m.away]} size={18} alt={m.away} />
                  <span className="text-ink-50 font-medium">{m.away}</span>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  {m.prediction && (
                    <span>
                      <span className="font-medium text-host-blue-bright">{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-ink-500"> · {(m.prediction.p_draw * 100).toFixed(0)}% · </span>
                      <span className="font-medium text-host-red">{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </span>
                  )}
                  <span className="text-ink-400">{formatLocalKickoff(m.utc_date)}</span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {results && (
        <>
          {/* Played matches */}
          {(results.group_results.length > 0 || results.ko_results.length > 0) && (
            <SectionCard
              icon={ListOrdered}
              accent="green"
              title={`Played matches (${results.group_results.length + results.ko_results.length})`}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1.5 font-semibold">Grp</th>
                      <th className="text-right py-1.5 font-semibold">Team 1</th>
                      <th className="text-center py-1.5 px-2 font-semibold">Score</th>
                      <th className="text-left py-1.5 font-semibold">Team 2</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.group_results.map((r, i) => (
                      <tr key={i} className="border-b border-white/[0.05]">
                        <td className="py-1.5 text-ink-500">{r.group}</td>
                        <td className="py-1.5 text-right text-ink-200">
                          <FlagImage code={flags[r.team1]} size={14} />{' '}{r.team1}
                        </td>
                        <td className="py-1.5 text-center font-mono font-bold text-gold">
                          {r.score1} – {r.score2}
                        </td>
                        <td className="py-1.5 text-ink-200">
                          <FlagImage code={flags[r.team2]} size={14} />{' '}{r.team2}
                        </td>
                      </tr>
                    ))}
                    {results.ko_results.map((r, i) => (
                      <tr key={`ko-${i}`} className="border-b border-white/[0.05]">
                        <td className="py-1.5 text-ink-500">KO</td>
                        <td className="py-1.5 text-right text-ink-200">{r.team1}</td>
                        <td className="py-1.5 text-center text-ink-400">→ {r.winner}</td>
                        <td className="py-1.5 text-ink-200">{r.team2}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          )}

          {/* Group standings */}
          {Object.keys(results.standings).length > 0 && (
            <div>
              <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink-200 mb-3">
                Current group standings
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(results.standings).sort().map(([letter, group]) => (
                  <GlassCard key={letter} hover accent="blue" className="p-4">
                    <div className="font-display text-base uppercase tracking-[0.12em] text-gold mb-2.5">
                      Group {letter}
                    </div>
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                          <th className="text-left py-1 font-semibold">Team</th>
                          <th className="text-right py-1 px-1 font-semibold">P</th>
                          <th className="text-right py-1 px-1 font-semibold">W</th>
                          <th className="text-right py-1 px-1 font-semibold">Pts</th>
                          <th className="text-right py-1 px-1 font-semibold">GD</th>
                          <th className="text-right py-1 px-1 font-semibold">GF</th>
                          <th className="py-1 w-5"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.teams.map(t => (
                          <tr key={t.team} className="border-b border-white/[0.05]">
                            <td className="py-1 text-ink-100">
                              <FlagImage code={flags[t.team]} size={12} />{' '}{t.team}
                            </td>
                            <td className="text-right py-1 px-1 text-ink-500">{t.played}</td>
                            <td className="text-right py-1 px-1 text-ink-300">{t.wins ?? 0}</td>
                            <td className="text-right py-1 px-1 font-bold text-ink-50">{t.pts}</td>
                            <td className="text-right py-1 px-1 text-ink-300">{t.gd > 0 ? '+' : ''}{t.gd}</td>
                            <td className="text-right py-1 px-1 text-ink-300">{t.gf}</td>
                            <td className="text-center py-1">
                              <StatusIcon status={t.status} message={t.message} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {/* Scenarios — colour reflects 2026 WC advancement path */}
                    <div className="mt-2.5 space-y-1">
                      {group.teams.map(t => (
                        <div key={t.team} className="text-[11px] leading-relaxed" style={{ color: statusColor(t) }}>
                          <FlagImage code={flags[t.team]} size={10} />{' '}
                          <strong>{t.team}</strong> — {t.message}
                        </div>
                      ))}
                    </div>
                    {/* Remaining fixtures */}
                    {group.remaining_fixtures.length > 0 && (
                      <div className="mt-2.5 text-[11px] text-ink-500">
                        Remaining: {group.remaining_fixtures.map(f => `${f.team1} vs ${f.team2}`).join(' · ')}
                      </div>
                    )}
                  </GlassCard>
                ))}
              </div>
            </div>
          )}

          {/* Third-place race */}
          <Collapsible title="Third-place race — best 8 advance to R32" icon={Medal} accent="gold">
            <ThirdPlaceTable thirds={results.third_place_race} flags={flags} />
          </Collapsible>

          {/* Goal stats */}
          <Collapsible title="Tournament goal statistics" icon={Goal} accent="green">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Total goals" value={results.goal_stats.total_goals} accent="green" />
                <StatCard label="Goals / game" value={results.goal_stats.goals_per_game} accent="gold" />
                <StatCard label="Matches played" value={results.goal_stats.games_played} accent="blue" />
              </div>
              {results.goal_stats.top_scorers.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-1.5">
                      Top scoring teams
                    </div>
                    {results.goal_stats.top_scorers.slice(0, 6).map(([t, g]) => (
                      <div key={t} className="py-0.5 text-ink-200">
                        <FlagImage code={flags[t]} size={12} />{' '}{t} — <strong className="text-gold">{g}</strong>
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-1.5">
                      Best defences
                    </div>
                    {results.goal_stats.best_defences.slice(0, 6).map(([t, g]) => (
                      <div key={t} className="py-0.5 text-ink-200">
                        <FlagImage code={flags[t]} size={12} />{' '}{t} — <strong className="text-host-green">{g}</strong> against
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Collapsible>

          {/* Schedule */}
          <Collapsible title="Full match schedule" icon={CalendarDays} accent="blue">
            <div className="space-y-1.5">
              {(scheduleData?.matches ?? []).map((m, i) => (
                <div key={i} className="flex items-center justify-between gap-2 flex-wrap bg-ink-950/40 border border-white/[0.05] rounded-lg px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <FlagImage code={flags[m.home]} size={14} />{' '}
                    <span className="font-semibold text-ink-50">{m.home}</span>
                    <span className="text-ink-500 uppercase">vs</span>
                    <FlagImage code={flags[m.away]} size={14} />{' '}
                    <span className="font-semibold text-ink-50">{m.away}</span>
                    <span className="text-ink-400">{formatLocalKickoff(m.utc_date)}</span>
                  </div>
                  {m.prediction && (
                    <div className="flex gap-2 text-xs">
                      <span className="font-bold text-host-blue-bright">{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-ink-500">{(m.prediction.p_draw * 100).toFixed(0)}%</span>
                      <span className="font-bold text-host-red">{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Collapsible>

          {/* Live bracket */}
          <SectionCard icon={Trophy} accent="gold" title="Live bracket">
            <BracketViewer type="live" />
          </SectionCard>
        </>
      )}

      {/* Manual result entry */}
      <SectionCard icon={Pencil} accent="red" title="Enter a result manually">
        <p className="text-xs text-ink-400 mb-3 -mt-1">
          Fallback for when the dataset hasn't updated yet. Manual results are locked into simulations.
        </p>
        <div className="flex flex-wrap gap-2.5 items-end">
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-400 block mb-1">Team 1</label>
            <select value={mT1} onChange={e => setMT1(e.target.value)} className={`px-2.5 py-2 min-h-10 ${inputClass}`}>
              {allTeams.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-400 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS1} onChange={e => setMS1(+e.target.value)}
              className={`w-16 px-2.5 py-2 min-h-10 ${inputClass}`} />
          </div>
          <span className="text-ink-500 mb-2.5">–</span>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-400 block mb-1">Goals</label>
            <input type="number" min={0} max={15} value={mS2} onChange={e => setMS2(+e.target.value)}
              className={`w-16 px-2.5 py-2 min-h-10 ${inputClass}`} />
          </div>
          <div>
            <label className="text-[11px] uppercase tracking-[0.14em] font-semibold text-ink-400 block mb-1">Team 2</label>
            <select value={mT2} onChange={e => setMT2(e.target.value)} className={`px-2.5 py-2 min-h-10 ${inputClass}`}>
              {allTeams.map(t => <option key={t} value={t} className="bg-ink-900">{t}</option>)}
            </select>
          </div>
          <Button
            variant="blue"
            onClick={() => {
              if (mT1 === mT2) return
              if (groupOf[mT1] !== groupOf[mT2]) return
              addManualResult({ team1: mT1, team2: mT2, score1: mS1, score2: mS2 })
            }}
          >
            Add result
          </Button>
        </div>
        {manualResults.length > 0 && (
          <div className="space-y-1 text-xs mt-3">
            <div className="text-ink-400">{manualResults.length} manual result(s) active:</div>
            {manualResults.map((r, i) => (
              <div key={i} className="flex items-center gap-2 text-ink-200">
                <span>{r.team1} {r.score1}–{r.score2} {r.team2}</span>
              </div>
            ))}
            <button
              onClick={clearManualResults}
              className="text-xs text-host-red hover:opacity-70 transition-opacity cursor-pointer"
            >
              Clear all manual results
            </button>
          </div>
        )}
      </SectionCard>
    </div>
  )
}

function ThirdPlaceTable({ thirds, flags }: { thirds: ThirdPlaceTeam[]; flags: Record<string, string> }) {
  if (!thirds.length) return <div className="text-ink-400 text-sm">No groups have started yet.</div>
  return (
    <div>
      <p className="text-xs text-ink-400 mb-3">
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
                  <div className="flex-1 border-t border-dashed border-host-red/40" />
                  <span className="text-xs whitespace-nowrap px-1 text-host-red uppercase tracking-wider">
                    cutoff — top 8 advance
                  </span>
                  <div className="flex-1 border-t border-dashed border-host-red/40" />
                </div>
              )}
              <div className="flex items-center gap-2 text-xs">
                <span className="text-ink-500 w-5 text-right shrink-0">{idx + 1}</span>
                <span className="text-ink-500 w-4 shrink-0">{r.group}</span>
                <div className="flex items-center gap-1 w-28 shrink-0">
                  <FlagImage code={flags[r.team]} size={12} />
                  <span className={`truncate ${isTop8 ? 'text-ink-50 font-medium' : 'text-ink-500'}`}>{r.team}</span>
                </div>
                <div className="flex-1 relative h-4 bg-white/[0.06] rounded overflow-hidden">
                  {!r.group_done && maxPct > barPct && (
                    <div className="absolute inset-y-0 left-0 bg-white/[0.10] rounded" style={{ width: `${maxPct}%` }} />
                  )}
                  <div
                    className="absolute inset-y-0 left-0 rounded"
                    style={{ width: `${barPct}%`, backgroundColor: isTop8 ? 'var(--color-host-green)' : 'var(--color-ink-500)' }}
                  />
                </div>
                <span className={`font-bold w-6 text-right shrink-0 ${isTop8 ? 'text-ink-50' : 'text-ink-500'}`}>{r.pts}pt</span>
                <span className="text-ink-500 w-10 text-right shrink-0">{r.gd > 0 ? '+' : ''}{r.gd} GD</span>
                {!r.group_done && (
                  <span className="text-ink-600 w-8 text-right shrink-0 hidden sm:inline">+{r.remaining * 3}?</span>
                )}
              </div>
            </Fragment>
          )
        })}
      </div>
    </div>
  )
}
