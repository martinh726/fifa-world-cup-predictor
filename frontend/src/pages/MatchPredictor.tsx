import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchPredict, fetchTeams } from '../api'
import { useAppStore } from '../store/useAppStore'
import { TeamSelect } from '../components/shared/TeamSelect'
import { MetricCard } from '../components/shared/MetricCard'
import { FlagImage } from '../components/shared/FlagImage'
import { ProbabilityBar } from '../components/charts/ProbabilityBar'
import { ScorelineHeatmap } from '../components/charts/ScorelineHeatmap'

export function MatchPredictor() {
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const { injuries, squadStrength } = useAppStore()

  const teams = teamsData?.teams ?? []
  const flags = teamsData?.flags ?? {}
  const hosts = new Set(teamsData?.hosts ?? [])

  const [home, setHome] = useState('Argentina')
  const [away, setAway] = useState('France')

  // Determine neutral: if one is host, they're home; both hosts or neither → neutral
  const sameHostStatus = (home in Object.fromEntries([...hosts].map(h => [h, true]))) === (away in Object.fromEntries([...hosts].map(h => [h, true])))
  const neutral = sameHostStatus

  const { data, isLoading, error } = useQuery({
    queryKey: ['predict', home, away, neutral, squadStrength, injuries],
    queryFn: () => fetchPredict(home, away, neutral, squadStrength, injuries),
    enabled: !!(home && away && home !== away),
    staleTime: 60_000,
  })

  const [showSquad, setShowSquad] = useState(true)
  const [showH2H, setShowH2H] = useState(false)

  if (!teams.length) return <div className="text-slate-400 p-8">Loading teams…</div>

  return (
    <div className="space-y-5">
      {/* Team selectors */}
      <div className="grid grid-cols-2 gap-4">
        <TeamSelect teams={teams} flags={flags} value={home} onChange={setHome} label="Team 1" />
        <TeamSelect teams={teams} flags={flags} value={away} onChange={setAway} label="Team 2" />
      </div>

      {home === away && (
        <div className="text-yellow-400 text-sm bg-yellow-400/10 rounded-lg px-4 py-3">
          Pick two different teams.
        </div>
      )}

      {home !== away && (
        <>
          {/* Flag banner */}
          <div className="flex items-center justify-center gap-4">
            <FlagImage code={flags[home]} size={48} alt={home} />
            <span className="text-2xl font-bold">{home} vs {away}</span>
            <FlagImage code={flags[away]} size={48} alt={away} />
          </div>

          {isLoading && <div className="text-slate-400 text-sm">Predicting…</div>}
          {error && <div className="text-red-400 text-sm">Prediction failed</div>}

          {data && (
            <>
              {/* Probabilities */}
              <div className="grid grid-cols-4 gap-3">
                <MetricCard label={`${home} win`} value={`${(data.p_home * 100).toFixed(1)}%`} color="#2563eb" />
                <MetricCard label="Draw" value={`${(data.p_draw * 100).toFixed(1)}%`} color="#9ca3af" />
                <MetricCard label={`${away} win`} value={`${(data.p_away * 100).toFixed(1)}%`} color="#dc2626" />
                <MetricCard label="xG" value={`${data.lambda_home.toFixed(2)} – ${data.lambda_away.toFixed(2)}`} />
              </div>

              <ProbabilityBar
                home={home} away={away}
                pHome={data.p_home} pDraw={data.p_draw} pAway={data.p_away}
              />

              {/* Squad comparison */}
              <details open={showSquad} onToggle={e => setShowSquad((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700">
                  🧑‍🤝‍🧑 Squad comparison
                </summary>
                <div className="mt-2 bg-slate-800 rounded-lg p-4">
                  <div className="grid grid-cols-3 text-sm">
                    <div className="font-bold text-right pr-4">{home}</div>
                    <div className="text-center text-slate-400">Metric</div>
                    <div className="font-bold pl-4">{away}</div>
                    {[
                      ['Squad value (€M)', data.squad.home.squad_value_m?.toLocaleString() + 'M', data.squad.away.squad_value_m?.toLocaleString() + 'M'],
                      ['FIFA ranking', `#${data.squad.home.fifa_rank}`, `#${data.squad.away.fifa_rank}`],
                      ['Top-5 league %', `${((data.squad.home.league_idx ?? 0) * 100).toFixed(0)}%`, `${((data.squad.away.league_idx ?? 0) * 100).toFixed(0)}%`],
                      ['Avg caps', data.squad.home.avg_caps?.toFixed(0), data.squad.away.avg_caps?.toFixed(0)],
                      ['Coach win rate', `${((data.squad.home.coach_wr ?? 0) * 100).toFixed(0)}%`, `${((data.squad.away.coach_wr ?? 0) * 100).toFixed(0)}%`],
                    ].map(([metric, hv, av]) => (
                      <>
                        <div className="text-right pr-4 py-1 text-blue-400 font-semibold">{hv ?? '—'}</div>
                        <div className="text-center py-1 text-slate-500">{metric}</div>
                        <div className="pl-4 py-1 text-red-400 font-semibold">{av ?? '—'}</div>
                      </>
                    ))}
                  </div>
                </div>
              </details>

              {/* Scoreline heatmap + top scores */}
              <div className="grid grid-cols-[2fr_1fr] gap-4">
                <div>
                  <div className="text-sm text-slate-400 mb-1">Scoreline probabilities</div>
                  <ScorelineHeatmap matrix={data.score_matrix} home={home} away={away} />
                </div>
                <div className="bg-slate-800 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="text-sm font-semibold text-slate-300 mb-2">Most likely scorelines</div>
                    {data.top_scores.map(([h, a, p]) => (
                      <div key={`${h}-${a}`} className="text-sm py-1">
                        <span className="font-mono bg-slate-700 px-2 py-0.5 rounded">
                          {home} {h} – {a} {away}
                        </span>
                        <span className="text-slate-400 ml-2">{(p * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-slate-700 pt-3">
                    <div className="text-sm font-semibold text-slate-300 mb-1">Elo ratings</div>
                    <div className="text-sm text-slate-300">
                      {home}: <strong>{data.elo_home.toFixed(0)}</strong>
                    </div>
                    <div className="text-sm text-slate-300">
                      {away}: <strong>{data.elo_away.toFixed(0)}</strong>
                    </div>
                  </div>
                </div>
              </div>

              {/* H2H history */}
              <details open={showH2H} onToggle={e => setShowH2H((e.target as HTMLDetailsElement).open)}>
                <summary className="cursor-pointer text-sm font-semibold text-slate-300 bg-slate-800 px-4 py-2 rounded-lg hover:bg-slate-700">
                  📊 Head-to-head history
                </summary>
                {data.h2h.total === 0 ? (
                  <div className="mt-2 text-slate-400 text-sm px-2">No historical meetings in the dataset.</div>
                ) : (
                  <div className="mt-2 bg-slate-800 rounded-lg p-4 space-y-3">
                    <div className="grid grid-cols-4 gap-3">
                      <MetricCard label="Meetings" value={data.h2h.total} />
                      <MetricCard label={`${home} wins`} value={`${data.h2h.team1_wins} (${((data.h2h.team1_wins / data.h2h.total) * 100).toFixed(0)}%)`} color="#2563eb" />
                      <MetricCard label="Draws" value={`${data.h2h.draws} (${((data.h2h.draws / data.h2h.total) * 100).toFixed(0)}%)`} />
                      <MetricCard label={`${away} wins`} value={`${data.h2h.team2_wins} (${((data.h2h.team2_wins / data.h2h.total) * 100).toFixed(0)}%)`} color="#dc2626" />
                    </div>
                    <div>
                      <div className="text-sm font-semibold text-slate-300 mb-2">Last 5 meetings</div>
                      {data.h2h.last5.map((m, i) => {
                        const homeWon = m.score_home > m.score_away
                        const awayWon = m.score_away > m.score_home
                        return (
                          <div key={i} className="text-sm py-1 text-slate-300">
                            <span className="text-slate-500 font-mono mr-2">{m.date}</span>
                            <span className={homeWon ? 'font-bold text-white' : ''}>{m.home}</span>
                            {' '}<span className="text-slate-400">{m.score_home}–{m.score_away}</span>{' '}
                            <span className={awayWon ? 'font-bold text-white' : ''}>{m.away}</span>
                            <span className="text-slate-500 italic ml-2 text-xs">{m.tournament}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </details>
            </>
          )}
        </>
      )}
    </div>
  )
}
