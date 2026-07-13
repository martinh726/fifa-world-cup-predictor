import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Target, Users, Swords, TriangleAlert } from 'lucide-react'
import { fetchPredict, fetchTeams } from '../api'
import { useAppStore } from '../store/useAppStore'
import { TeamSelect } from '../components/shared/TeamSelect'
import { FlagImage } from '../components/shared/FlagImage'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard } from '../components/ui/GlassCard'
import { StatCard } from '../components/ui/StatCard'
import { Collapsible } from '../components/ui/Collapsible'
import { Skeleton, CardSkeleton } from '../components/ui/Skeleton'
import { QueryError } from '../components/ui/QueryError'
import { ProbabilityBar } from '../components/charts/ProbabilityBar'
import { ScorelineHeatmap } from '../components/charts/ScorelineHeatmap'

// Split-screen duel hero — home tinted host-blue, away tinted host-red,
// meeting at an angled gold seam.
function DuelHero({ home, away, flags }: { home: string; away: string; flags: Record<string, string> }) {
  return (
    <div className="relative overflow-hidden rounded-2xl border border-[var(--glass-border)] bg-ink-900/50 backdrop-blur-md">
      <div
        className="absolute inset-y-0 left-0 w-[58%] pointer-events-none"
        style={{
          background: 'linear-gradient(100deg, rgba(42,57,141,0.55), rgba(61,82,196,0.10))',
          clipPath: 'polygon(0 0, 100% 0, 84% 100%, 0 100%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute inset-y-0 right-0 w-[58%] pointer-events-none"
        style={{
          background: 'linear-gradient(260deg, rgba(230,29,37,0.45), rgba(230,29,37,0.08))',
          clipPath: 'polygon(16% 0, 100% 0, 100% 100%, 0 100%)',
        }}
        aria-hidden="true"
      />
      {/* Gold seam */}
      <div
        className="absolute left-1/2 top-[-12%] bottom-[-12%] w-px bg-gold/60 pointer-events-none"
        style={{ transform: 'rotate(9deg)' }}
        aria-hidden="true"
      />

      <div className="relative grid grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-8 py-6 sm:py-8">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0">
          <FlagImage code={flags[home]} size={46} alt={home} />
          <span className="font-display text-xl sm:text-3xl uppercase tracking-wide text-ink-50 truncate">
            {home}
          </span>
        </div>
        <span className="font-display text-lg sm:text-2xl text-gold tracking-[0.2em] px-2 select-none">
          VS
        </span>
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 justify-end">
          <span className="font-display text-xl sm:text-3xl uppercase tracking-wide text-ink-50 truncate text-right">
            {away}
          </span>
          <FlagImage code={flags[away]} size={46} alt={away} />
        </div>
      </div>
    </div>
  )
}

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

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['predict', home, away, neutral, squadStrength, injuries],
    queryFn: () => fetchPredict(home, away, neutral, squadStrength, injuries),
    enabled: !!(home && away && home !== away),
    staleTime: 60_000,
  })

  if (!teams.length) {
    return (
      <div className="stagger space-y-6">
        <PageHeader title="Match Predictor" icon={Target} subtitle="Head-to-head win probabilities from the blended Elo + squad model." />
        <CardSkeleton lines={4} />
      </div>
    )
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Match Predictor"
        icon={Target}
        subtitle="Pick any two nations — win probabilities, expected goals, and scoreline odds from the blended Elo + squad model."
      />

      {/* Team selectors */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TeamSelect teams={teams} flags={flags} value={home} onChange={setHome} label="Team 1" />
        <TeamSelect teams={teams} flags={flags} value={away} onChange={setAway} label="Team 2" />
      </div>

      {home === away && (
        <div className="flex items-center gap-2.5 text-sm rounded-xl px-4 py-3 text-warning bg-warning-bg border border-warning/25">
          <TriangleAlert size={15} />
          Pick two different teams.
        </div>
      )}

      {home !== away && (
        <>
          <DuelHero home={home} away={away} flags={flags} />

          {isLoading && (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
              </div>
              <CardSkeleton lines={2} />
            </>
          )}
          {isError && <QueryError title="Prediction failed" onRetry={() => refetch()} />}

          {data && (
            <>
              {/* Probabilities */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard label={`${home} win`} value={`${(data.p_home * 100).toFixed(1)}%`} accent="blue" />
                <StatCard label="Draw" value={`${(data.p_draw * 100).toFixed(1)}%`} accent="neutral" />
                <StatCard label={`${away} win`} value={`${(data.p_away * 100).toFixed(1)}%`} accent="red" />
                <StatCard label="Expected goals" value={`${data.lambda_home.toFixed(2)} – ${data.lambda_away.toFixed(2)}`} accent="gold" />
              </div>

              <GlassCard className="p-4">
                <ProbabilityBar
                  home={home} away={away}
                  pHome={data.p_home} pDraw={data.p_draw} pAway={data.p_away}
                />
              </GlassCard>

              {/* Squad comparison */}
              <Collapsible title="Squad comparison" icon={Users} accent="blue" defaultOpen>
                <div className="grid grid-cols-3 text-sm">
                  <div className="font-display uppercase tracking-wide text-right pr-4 text-host-blue-bright truncate">{home}</div>
                  <div className="text-center text-[11px] uppercase tracking-[0.14em] text-ink-500 self-center">Metric</div>
                  <div className="font-display uppercase tracking-wide pl-4 text-host-red truncate">{away}</div>
                  {[
                    ['Squad value (€M)', data.squad.home.squad_value_m?.toLocaleString() + 'M', data.squad.away.squad_value_m?.toLocaleString() + 'M'],
                    ['FIFA ranking', `#${data.squad.home.fifa_rank}`, `#${data.squad.away.fifa_rank}`],
                    ['Top-5 league %', `${((data.squad.home.league_idx ?? 0) * 100).toFixed(0)}%`, `${((data.squad.away.league_idx ?? 0) * 100).toFixed(0)}%`],
                    ['Avg caps', data.squad.home.avg_caps?.toFixed(0), data.squad.away.avg_caps?.toFixed(0)],
                    ['Coach win rate', `${((data.squad.home.coach_wr ?? 0) * 100).toFixed(0)}%`, `${((data.squad.away.coach_wr ?? 0) * 100).toFixed(0)}%`],
                  ].map(([metric, hv, av]) => (
                    <Fragment key={metric}>
                      <div className="text-right pr-4 py-1.5 font-semibold text-host-blue-bright border-b border-white/[0.05]">{hv ?? '—'}</div>
                      <div className="text-center py-1.5 text-ink-400 text-xs border-b border-white/[0.05]">{metric}</div>
                      <div className="pl-4 py-1.5 font-semibold text-host-red border-b border-white/[0.05]">{av ?? '—'}</div>
                    </Fragment>
                  ))}
                </div>
              </Collapsible>

              {/* Scoreline heatmap + top scores */}
              <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
                <GlassCard className="p-4">
                  <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2">
                    Scoreline probabilities
                  </div>
                  <ScorelineHeatmap matrix={data.score_matrix} home={home} away={away} />
                </GlassCard>
                <GlassCard className="p-4 space-y-4">
                  <div>
                    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2.5">
                      Most likely scorelines
                    </div>
                    {data.top_scores.map(([h, a, p]) => (
                      <div key={`${h}-${a}`} className="flex items-center justify-between text-sm py-1.5 border-b border-white/[0.05] last:border-0">
                        <span className="font-mono bg-white/[0.06] text-ink-50 px-2 py-0.5 rounded-md text-[13px]">
                          {home} {h} – {a} {away}
                        </span>
                        <span className="text-gold font-semibold text-xs">{(p * 100).toFixed(1)}%</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-white/[0.08] pt-3.5">
                    <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2">
                      Elo ratings
                    </div>
                    <div className="flex items-baseline justify-between text-sm text-ink-200 py-0.5">
                      <span>{home}</span>
                      <span className="font-display text-lg text-host-blue-bright">{data.elo_home.toFixed(0)}</span>
                    </div>
                    <div className="flex items-baseline justify-between text-sm text-ink-200 py-0.5">
                      <span>{away}</span>
                      <span className="font-display text-lg text-host-red">{data.elo_away.toFixed(0)}</span>
                    </div>
                  </div>
                </GlassCard>
              </div>

              {/* H2H history */}
              <Collapsible title="Head-to-head history" icon={Swords} accent="gold">
                {data.h2h.total === 0 ? (
                  <div className="text-ink-400 text-sm">No historical meetings in the dataset.</div>
                ) : (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                      <StatCard label="Meetings" value={data.h2h.total} accent="gold" />
                      <StatCard label={`${home} wins`} value={`${data.h2h.team1_wins} (${((data.h2h.team1_wins / data.h2h.total) * 100).toFixed(0)}%)`} accent="blue" />
                      <StatCard label="Draws" value={`${data.h2h.draws} (${((data.h2h.draws / data.h2h.total) * 100).toFixed(0)}%)`} accent="neutral" />
                      <StatCard label={`${away} wins`} value={`${data.h2h.team2_wins} (${((data.h2h.team2_wins / data.h2h.total) * 100).toFixed(0)}%)`} accent="red" />
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2">
                        Last 5 meetings
                      </div>
                      {data.h2h.last5.map((m, i) => {
                        const homeWon = m.score_home > m.score_away
                        const awayWon = m.score_away > m.score_home
                        return (
                          <div key={i} className="text-sm py-1.5 text-ink-200 border-b border-white/[0.05] last:border-0">
                            <span className="text-ink-500 font-mono mr-2 text-xs">{m.date}</span>
                            <span className={homeWon ? 'font-bold text-ink-50' : ''}>{m.home}</span>
                            {' '}<span className="text-gold font-mono">{m.score_home}–{m.score_away}</span>{' '}
                            <span className={awayWon ? 'font-bold text-ink-50' : ''}>{m.away}</span>
                            <span className="text-ink-500 italic ml-2 text-xs">{m.tournament}</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </Collapsible>
            </>
          )}
        </>
      )}
    </div>
  )
}
