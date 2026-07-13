import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Flag, Trophy, ListOrdered, Goal, GitBranch, CalendarClock, CircleCheck, CircleX, Info,
  TrendingUp, Users, Target,
} from 'lucide-react'
import { fetchTeam, fetchTeams } from '../api'
import type { FormMatch } from '../api/types'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { TeamSelect } from '../components/shared/TeamSelect'
import { BrandArcPattern } from '../components/shared/BrandArcPattern'
import { SingleTeamOddsBar } from '../components/charts/ChampionshipOddsBar'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard, SectionCard } from '../components/ui/GlassCard'
import { StatCard } from '../components/ui/StatCard'
import { CardSkeleton } from '../components/ui/Skeleton'
import { QueryError } from '../components/ui/QueryError'
import { formatLocalKickoff } from '../utils/time'

const RESULT_COLOR: Record<FormMatch['result'], string> = {
  W: 'var(--color-host-green)', D: 'var(--color-ink-400)', L: 'var(--color-host-red)',
}

function FormStrip({ matches }: { matches: FormMatch[] }) {
  if (!matches.length) return <span className="text-ink-500 text-sm">No recent competitive matches.</span>
  // matches arrive most-recent-first; display chronologically (oldest -> most recent, left to right)
  const chrono = [...matches].reverse()
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {chrono.map((m, i) => {
        const color = RESULT_COLOR[m.result]
        return (
          <span
            key={i}
            title={`${m.result === 'W' ? 'Won' : m.result === 'L' ? 'Lost' : 'Drew'} ${m.goals_for}-${m.goals_against} vs ${m.opponent} (${m.date})`}
            className="w-7 h-7 grid place-items-center rounded-md text-xs font-display border cursor-default"
            style={{ color, borderColor: color, backgroundColor: 'rgba(255,255,255,0.03)' }}
          >
            {m.result}
          </span>
        )
      })}
    </div>
  )
}

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

  const { data, isLoading, isError, refetch } = useQuery({
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
    <div className="stagger space-y-5">
      <PageHeader
        title="Team Focus"
        icon={Flag}
        subtitle="Deep-dive on a single nation — form, standings, and tournament path."
      />

      {/* Team selector */}
      <div className="max-w-xs">
        <TeamSelect teams={teams} flags={flags} value={selectedTeam} onChange={setSelectedTeam} label="Select team" />
      </div>

      {isLoading && <CardSkeleton lines={4} />}
      {isError && <QueryError title="Failed to load team data" onRetry={() => refetch()} />}

      {data && (
        <>
          {/* Hero header */}
          <GlassCard className="border-beam relative overflow-hidden p-6 sm:p-8 flex items-center gap-5 sm:gap-7 flex-wrap">
            <BrandArcPattern variant="corner" opacity={0.12} className="absolute top-0 right-0 w-36 h-36 pointer-events-none" />
            <FlagImage code={data.flag_code ?? flags[selectedTeam]} size={72} alt={data.team} />
            <div className="relative min-w-0">
              <h2 className="font-display text-3xl sm:text-4xl uppercase tracking-wide text-ink-50">
                {data.team}
              </h2>
              <div className="flex items-center gap-3 mt-2 flex-wrap">
                <span className="text-ink-400 text-sm">Group {data.group}</span>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gold/10 border border-gold/35 text-gold text-xs font-bold">
                  Elo {data.elo?.toFixed(0) ?? '—'}
                  {data.elo_rank && <span className="text-gold/70 font-semibold">· #{data.elo_rank} of 48</span>}
                </span>
              </div>
              {!lastSimResult && (
                <div className="flex items-center gap-1.5 text-xs mt-2 text-warning">
                  <Info size={12} />
                  Run a simulation on the Simulator tab to see championship odds.
                </div>
              )}
              <div className="mt-3.5">
                <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-500 mb-1.5">
                  Form (last {data.form.matches.length} competitive)
                </div>
                <FormStrip matches={data.form.matches} />
              </div>
            </div>
          </GlassCard>

          {/* Pedigree */}
          <SectionCard icon={TrendingUp} accent="green" title="World Cup pedigree">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Appearances" value={data.wc_history.appearances} accent="neutral" />
              <StatCard
                label="Titles"
                value={data.wc_history.titles}
                accent={data.wc_history.titles > 0 ? 'gold' : 'neutral'}
              />
              <StatCard
                label="All-time WC record"
                value={`${data.wc_history.wins}-${data.wc_history.draws}-${data.wc_history.losses}`}
                sub={`${data.wc_history.matches_played} matches played`}
                accent="blue"
              />
              <StatCard
                label="Shootout record"
                value={data.shootouts.played > 0 ? `${data.shootouts.won}-${data.shootouts.lost}` : '—'}
                sub={data.shootouts.played > 0 ? `${data.shootouts.played} shootouts` : 'None on record'}
                accent="red"
              />
            </div>
          </SectionCard>

          {/* Squad metrics (what the model uses) */}
          {data.squad && (
            <SectionCard icon={Users} accent="blue" title="Squad profile">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <StatCard label="Squad value" value={`€${data.squad.squad_value_m?.toLocaleString() ?? '—'}M`} accent="gold" />
                <StatCard label="FIFA ranking" value={`#${data.squad.fifa_rank ?? '—'}`} accent="neutral" />
                <StatCard label="Top-5 league %" value={`${((data.squad.league_idx ?? 0) * 100).toFixed(0)}%`} accent="blue" />
                <StatCard label="Avg caps" value={data.squad.avg_caps?.toFixed(0) ?? '—'} accent="neutral" />
                <StatCard label="Coach win rate" value={`${((data.squad.coach_wr ?? 0) * 100).toFixed(0)}%`} accent="green" />
                <StatCard
                  label="Composite score"
                  value={data.squad.composite_score.toFixed(2)}
                  sub="Feeds the model's squad-strength adjustment"
                  accent={data.squad.composite_score >= 0 ? 'green' : 'red'}
                  icon={Target}
                />
              </div>
            </SectionCard>
          )}

          {/* Championship odds */}
          {odds ? (
            <SectionCard icon={Trophy} accent="gold" title="Championship odds (from simulation)">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                {Object.entries(STAGE_LABELS).map(([key, label]) => (
                  <StatCard
                    key={key}
                    label={label}
                    value={`${((odds[key] ?? 0) * 100).toFixed(1)}%`}
                    accent={key === 'P(Champion)' ? 'gold' : 'neutral'}
                  />
                ))}
              </div>
              <SingleTeamOddsBar odds={odds} team={data.team} />
            </SectionCard>
          ) : (
            <GlassCard className="p-5 text-ink-400 text-sm text-center">
              Run a simulation to see championship odds for {data.team}.
            </GlassCard>
          )}

          {/* Group standing */}
          {data.group_standing.length > 0 && (
            <SectionCard icon={ListOrdered} accent="blue" title={`Group ${data.group} standings`}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-ink-400 border-b border-white/[0.08] text-[11px] uppercase tracking-wider">
                    <th className="text-left py-1.5 font-semibold">Team</th>
                    <th className="text-right py-1.5 font-semibold">P</th>
                    <th className="text-right py-1.5 font-semibold">Pts</th>
                    <th className="text-right py-1.5 font-semibold">GD</th>
                    <th className="text-right py-1.5 font-semibold">GF</th>
                  </tr>
                </thead>
                <tbody>
                  {data.group_standing.map(row => {
                    const isSelected = row.team === selectedTeam
                    return (
                      <tr
                        key={row.team}
                        className={`border-b border-white/[0.05] ${isSelected ? 'bg-host-blue-bright/10' : ''}`}
                      >
                        <td className="py-1.5">
                          <FlagImage code={flags[row.team]} size={14} />{' '}
                          <span className={isSelected ? 'text-host-blue-bright font-bold' : 'text-ink-200'}>{row.team}</span>
                        </td>
                        <td className="text-right py-1.5 text-ink-500">{row.played}</td>
                        <td className="text-right py-1.5 text-ink-50 font-bold">{row.pts}</td>
                        <td className="text-right py-1.5 text-ink-300">{row.gd > 0 ? '+' : ''}{row.gd}</td>
                        <td className="text-right py-1.5 text-ink-300">{row.gf}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </SectionCard>
          )}

          {/* WC 2026 results */}
          {data.wc2026_results.length > 0 && (
            <SectionCard icon={Goal} accent="green" title="2026 WC results">
              <div className="space-y-2">
                {data.wc2026_results.map((r, i) => {
                  const color = r.result === 'W' ? 'var(--color-host-green)' : r.result === 'L' ? 'var(--color-host-red)' : 'var(--color-ink-400)'
                  return (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2.5">
                        <span
                          className="font-display w-7 h-7 grid place-items-center rounded-lg text-sm border"
                          style={{ color, borderColor: color, backgroundColor: 'rgba(255,255,255,0.03)' }}
                        >
                          {r.result}
                        </span>
                        <FlagImage code={flags[r.opponent]} size={16} />
                        <span className="text-ink-200">vs {r.opponent}</span>
                      </div>
                      <span className="font-mono text-ink-50">{r.goals_for} – {r.goals_against}</span>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Predicted bracket path */}
          {data.bracket_path && data.bracket_path.length > 0 && (
            <SectionCard icon={GitBranch} accent="gold" title="Predicted bracket path (most-likely simulation)">
              <div className="space-y-2">
                {data.bracket_path.map((step, i) => {
                  const won = step.winner === selectedTeam
                  return (
                    <div
                      key={i}
                      className="flex items-center justify-between rounded-xl px-3.5 py-2.5 text-sm border"
                      style={{
                        backgroundColor: won ? 'rgba(60,172,59,0.10)' : 'rgba(255,255,255,0.03)',
                        borderColor: won ? 'rgba(60,172,59,0.30)' : 'rgba(255,255,255,0.06)',
                      }}
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-ink-400 text-[11px] uppercase tracking-wider w-16">{step.stage}</span>
                        {step.opponent ? (
                          <>
                            <span className="text-ink-500">vs</span>
                            <FlagImage code={flags[step.opponent]} size={16} />
                            <span className="text-ink-200">{step.opponent}</span>
                          </>
                        ) : (
                          <span className="text-ink-500 italic">TBD</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-right">
                        {step.win_prob !== null && (
                          <span className="text-xs text-ink-400">
                            {(step.win_prob * 100).toFixed(0)}% win
                          </span>
                        )}
                        {step.winner ? (
                          won ? (
                            <span className="flex items-center gap-1 text-xs font-semibold text-host-green">
                              <CircleCheck size={13} /> Advance
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-xs font-semibold text-host-red">
                              <CircleX size={13} /> {step.winner} wins
                            </span>
                          )
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </SectionCard>
          )}

          {/* Next match */}
          {data.next_match && (
            <SectionCard icon={CalendarClock} accent="blue" title="Next match">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-3">
                  <FlagImage code={flags[data.next_match.home]} size={28} />
                  <span className="font-display uppercase tracking-wide text-ink-50">{data.next_match.home}</span>
                  <span className="text-ink-500 text-xs uppercase">vs</span>
                  <FlagImage code={flags[data.next_match.away]} size={28} />
                  <span className="font-display uppercase tracking-wide text-ink-50">{data.next_match.away}</span>
                </div>
                <div className="text-sm text-ink-400">
                  {formatLocalKickoff(data.next_match.utc_date)}
                </div>
              </div>
              {data.next_match.prediction && (
                <div className="flex gap-4 mt-3 text-sm">
                  <span className="font-semibold text-host-blue-bright">
                    {data.next_match.home} {(data.next_match.prediction.p_home * 100).toFixed(0)}%
                  </span>
                  <span className="text-ink-400">
                    Draw {(data.next_match.prediction.p_draw * 100).toFixed(0)}%
                  </span>
                  <span className="font-semibold text-host-red">
                    {data.next_match.away} {(data.next_match.prediction.p_away * 100).toFixed(0)}%
                  </span>
                </div>
              )}
            </SectionCard>
          )}
        </>
      )}
    </div>
  )
}
