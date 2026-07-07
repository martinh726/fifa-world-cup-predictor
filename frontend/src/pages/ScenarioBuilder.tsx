import { Fragment, useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { WandSparkles, Lock, Medal, GitBranch, ListOrdered, RotateCcw, CircleCheck, CircleX, Swords, Trophy } from 'lucide-react'
import toast from 'react-hot-toast'
import { fetchBracketLive, fetchResults, fetchSimulate, fetchTeams, fetchWhatIf } from '../api'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard } from '../components/ui/GlassCard'
import { Button } from '../components/ui/Button'
import { QueryError } from '../components/ui/QueryError'
import { CardSkeleton } from '../components/ui/Skeleton'
import { ChampionshipOddsBar } from '../components/charts/ChampionshipOddsBar'
import { cn } from '../utils/cn'
import type {
  GroupStanding, KoPick, LiveBracketMatch, R32Projection, SimulateResponse,
  StandingTeam, ThirdPlaceTeam, WhatIfResponse,
} from '../api/types'

// ─── Score stepper ────────────────────────────────────────────────────────────

function ScoreStepper({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const btn =
    'w-7 h-7 sm:w-6 sm:h-6 rounded-md bg-white/[0.07] border border-white/[0.08] hover:bg-white/[0.14] active:scale-90 text-ink-100 font-bold text-sm select-none transition-[background-color,transform] cursor-pointer grid place-items-center'
  return (
    <div className="flex items-center gap-1">
      <button onClick={() => onChange(Math.max(0, value - 1))} className={btn} aria-label="Decrease">
        −
      </button>
      <span className="w-5 text-center font-mono font-bold text-gold text-sm tabular-nums">
        {value}
      </span>
      <button onClick={() => onChange(Math.min(15, value + 1))} className={btn} aria-label="Increase">
        +
      </button>
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusDot(t: StandingTeam) {
  if (t.status === 'through') return <CircleCheck size={12} className="text-host-green inline" aria-label={t.message} />
  if (t.status === 'eliminated') return <CircleX size={12} className="text-host-red inline" aria-label={t.message} />
  return null
}

// ─── Result sub-components ────────────────────────────────────────────────────

function WhatIfGroupCard({
  letter,
  gdata,
  flags,
  isAffected,
}: {
  letter: string
  gdata: GroupStanding
  flags: Record<string, string>
  isAffected: boolean
}) {
  return (
    <GlassCard
      className={`p-4 ${isAffected ? 'ring-1 ring-gold/50 shadow-[0_0_28px_-8px_rgba(212,175,55,0.35)]' : ''}`}
    >
      <div className="font-display text-sm uppercase tracking-[0.14em] text-gold mb-2.5 flex items-center gap-2">
        Group {letter}
        {isAffected && (
          <span className="text-[10px] normal-case tracking-normal font-sans font-semibold text-gold-soft">
            — scenario applied
          </span>
        )}
      </div>
      <table className="w-full text-xs">
        <thead>
          <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
            <th className="text-left py-1 font-semibold">#</th>
            <th className="text-left py-1 font-semibold">Team</th>
            <th className="text-right py-1 px-1 font-semibold">Pts</th>
            <th className="text-right py-1 px-1 font-semibold">GD</th>
            <th className="text-right py-1 px-1 font-semibold">GF</th>
            <th className="py-1 w-5" />
          </tr>
        </thead>
        <tbody>
          {gdata.teams.map(t => (
            <tr
              key={t.team}
              className={`border-b border-white/[0.05] ${t.rank <= 2 ? 'text-ink-50' : 'text-ink-500'}`}
            >
              <td className="py-1 text-ink-500 pr-1">{t.rank}</td>
              <td className="py-1">
                <FlagImage code={flags[t.team]} size={12} />{' '}
                {t.team}
              </td>
              <td className="text-right py-1 px-1 font-bold">{t.pts}</td>
              <td className="text-right py-1 px-1">
                {t.gd > 0 ? '+' : ''}
                {t.gd}
              </td>
              <td className="text-right py-1 px-1">{t.gf}</td>
              <td className="text-center py-1">{statusDot(t)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  )
}

function WhatIfThirds({ thirds, flags }: { thirds: ThirdPlaceTeam[]; flags: Record<string, string> }) {
  if (!thirds.length)
    return <div className="text-ink-400 text-sm">No group matches recorded yet.</div>

  return (
    <GlassCard className="p-4">
      <p className="text-xs text-ink-400 mb-3">
        Top 8 advance to R32 · Pts → GD → GF · Light bar = max pts with games remaining
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
                  <span className={`truncate ${isTop8 ? 'text-ink-50 font-medium' : 'text-ink-500'}`}>
                    {r.team}
                  </span>
                </div>
                <div className="flex-1 relative h-4 bg-white/[0.06] rounded overflow-hidden">
                  {!r.group_done && maxPct > barPct && (
                    <div
                      className="absolute inset-y-0 left-0 bg-host-blue-bright/20 rounded"
                      style={{ width: `${maxPct}%` }}
                    />
                  )}
                  <div
                    className={`absolute inset-y-0 left-0 rounded ${isTop8 ? 'bg-host-blue-bright' : 'bg-ink-500'}`}
                    style={{ width: `${barPct}%` }}
                  />
                </div>
                <span className={`w-6 text-right font-bold shrink-0 ${isTop8 ? 'text-ink-50' : 'text-ink-500'}`}>
                  {r.pts}
                </span>
                <span className="text-ink-500 shrink-0 w-16 text-right">
                  {r.gd > 0 ? '+' : ''}
                  {r.gd} GD
                </span>
              </div>
            </Fragment>
          )
        })}
      </div>
    </GlassCard>
  )
}

function WhatIfR32({ projections, flags }: { projections: R32Projection[]; flags: Record<string, string> }) {
  if (!projections.length)
    return <div className="text-ink-400 text-sm">No R32 data available.</div>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
      {projections.map(m => (
        <GlassCard key={m.match} hover accent="blue" className="p-3 flex items-center gap-3 text-xs rounded-xl">
          <span className="text-ink-500 w-10 shrink-0 font-mono">M{m.match}</span>
          <div className="flex-1 truncate">
            {m.team1 ? (
              <span className="text-ink-50 font-medium">
                <FlagImage code={flags[m.team1]} size={12} /> {m.team1}
              </span>
            ) : (
              <span className="text-ink-500 italic">{m.note1}</span>
            )}
          </div>
          <span className="text-ink-500 shrink-0 uppercase">vs</span>
          <div className="flex-1 truncate text-right">
            {m.team2 ? (
              <span className="text-ink-50 font-medium">
                {m.team2} <FlagImage code={flags[m.team2]} size={12} />
              </span>
            ) : (
              <span className="text-ink-500 italic">{m.note2}</span>
            )}
          </div>
        </GlassCard>
      ))}
    </div>
  )
}

// ─── Knockout scenario tab ────────────────────────────────────────────────────

const KO_STAGE_ORDER: LiveBracketMatch['stage'][] = ['r32', 'r16', 'qf', 'sf', 'final']
const KO_STAGE_TITLES: Record<LiveBracketMatch['stage'], string> = {
  r32: 'Round of 32',
  r16: 'Round of 16',
  qf: 'Quarter-finals',
  sf: 'Semi-finals',
  final: 'Final',
}

interface ResolvedMatch {
  m: LiveBracketMatch
  t1: string | null
  t2: string | null
  winner: string | null
  pickable: boolean
}

function KnockoutScenario({ flags }: { flags: Record<string, string> }) {
  const { squadStrength } = useAppStore()
  const [picks, setPicks] = useState<Record<number, string>>({})
  const [simResult, setSimResult] = useState<SimulateResponse | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['bracket-live'],
    queryFn: fetchBracketLive,
    staleTime: 120_000,
  })

  // Resolve each match's effective teams: real names stay, 'W{n}' slots cascade
  // from earlier real winners or user picks. A pick that no longer matches its
  // match's resolved teams (an upstream pick changed) is silently ignored.
  const resolved = useMemo<ResolvedMatch[]>(() => {
    const matches = [...(data?.matches ?? [])].sort((a, b) => a.match - b.match)
    const winners = new Map<number, string | null>()
    const isConcrete = (t: string) => t in flags

    const resolveSide = (team: string, slot: string): string | null => {
      const clean = team.replace(/\*$/, '')
      if (isConcrete(clean)) return clean
      const wm = /^W(\d+)$/.exec(slot)
      if (wm) return winners.get(Number(wm[1])) ?? null
      return null
    }

    const out: ResolvedMatch[] = []
    for (const m of matches) {
      const t1 = resolveSide(m.team1, m.slot1)
      const t2 = resolveSide(m.team2, m.slot2)
      let winner: string | null = null
      if (m.actual) {
        winner = m.winner
      } else {
        const p = picks[m.match]
        if (p && (p === t1 || p === t2)) winner = p
      }
      winners.set(m.match, winner)
      out.push({ m, t1, t2, winner, pickable: !m.actual && !!t1 && !!t2 })
    }
    return out
  }, [data, picks, flags])

  const validPicks: KoPick[] = resolved
    .filter(r => !r.m.actual && r.winner && r.t1 && r.t2)
    .map(r => ({ team1: r.t1!, team2: r.t2!, winner: r.winner! }))

  const { mutate: simulate, isPending } = useMutation({
    mutationFn: fetchSimulate,
    onSuccess: setSimResult,
    onError: () => toast.error('Simulation failed — is the backend running?'),
  })

  const handleSimulate = () =>
    simulate({
      n_sims: 5000,
      lock_real_results: true,
      manual_results: [],
      squad_strength: squadStrength,
      ko_picks: validPicks,
    })

  const handleReset = () => {
    setPicks({})
    setSimResult(null)
  }

  if (isLoading) return <CardSkeleton lines={6} />
  if (isError) return <QueryError onRetry={() => refetch()} />

  const anyPending = resolved.some(r => r.pickable)
  const sortedSummary = simResult
    ? [...simResult.summary].sort((a, b) => (b['P(Champion)'] ?? 0) - (a['P(Champion)'] ?? 0))
    : []

  const teamButton = (r: ResolvedMatch, team: string | null, raw: string) => {
    if (!team) {
      return (
        <span className="flex-1 px-2 py-1.5 text-xs text-ink-500 italic truncate">
          {raw.replace(/^W(\d+)$/, 'Winner M$1')}
        </span>
      )
    }
    const isWinner = r.winner === team
    return (
      <button
        disabled={!r.pickable}
        onClick={() =>
          setPicks(prev => {
            const next = { ...prev }
            if (prev[r.m.match] === team) delete next[r.m.match]
            else next[r.m.match] = team
            return next
          })
        }
        className={cn(
          'flex-1 flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs truncate transition-colors min-w-0',
          r.pickable && 'cursor-pointer hover:bg-white/[0.08]',
          isWinner
            ? 'bg-host-green/20 text-ink-50 font-semibold border border-host-green/50'
            : 'bg-white/[0.04] text-ink-200 border border-transparent',
        )}
      >
        <FlagImage code={flags[team]} size={12} />
        <span className="truncate">{team}</span>
        {isWinner && r.m.actual && <CircleCheck size={11} className="text-host-green shrink-0" />}
      </button>
    )
  }

  return (
    <div className="space-y-6">
      {!anyPending && (
        <GlassCard className="p-5 text-center text-ink-400 text-sm">
          No pending knockout matches with both teams known yet — picks unlock as
          the bracket fills in.
        </GlassCard>
      )}

      {KO_STAGE_ORDER.map(stage => {
        const stageMatches = resolved.filter(r => r.m.stage === stage)
        if (!stageMatches.length) return null
        return (
          <div key={stage}>
            <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-ink-100 mb-3">
              <Swords size={15} className="text-gold" /> {KO_STAGE_TITLES[stage]}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2.5">
              {stageMatches.map(r => (
                <GlassCard
                  key={r.m.match}
                  className={cn('p-2.5 flex items-center gap-2', r.m.actual && 'opacity-70')}
                >
                  <span className="text-ink-500 font-mono text-[10px] w-8 shrink-0">
                    M{r.m.match}
                  </span>
                  {teamButton(r, r.t1, r.m.team1)}
                  <span className="text-ink-500 text-[10px] uppercase shrink-0">vs</span>
                  {teamButton(r, r.t2, r.m.team2)}
                  {r.m.actual && <Lock size={11} className="text-ink-600 shrink-0" />}
                </GlassCard>
              ))}
            </div>
          </div>
        )
      })}

      {/* Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="secondary"
          icon={RotateCcw}
          onClick={handleReset}
          disabled={!Object.keys(picks).length && !simResult}
        >
          Reset
        </Button>
        <Button
          variant="primary"
          icon={WandSparkles}
          loading={isPending}
          onClick={handleSimulate}
          disabled={!validPicks.length}
        >
          {isPending ? 'Simulating…' : 'Simulate scenario'}
        </Button>
        {validPicks.length > 0 && !isPending && (
          <span className="text-ink-400 text-xs">
            {validPicks.length} pick{validPicks.length !== 1 ? 's' : ''} will be forced
            in every simulation
          </span>
        )}
      </div>

      {/* Results */}
      {simResult && (
        <div className="space-y-4 border-t border-white/[0.08] pt-6">
          <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-ink-100">
            <Trophy size={15} className="text-gold" /> Championship odds with your picks
          </h3>
          <p className="text-ink-400 text-xs">
            {simResult.n_sims.toLocaleString()} simulations · {validPicks.length} knockout
            pick{validPicks.length !== 1 ? 's' : ''} applied · real results locked
          </p>
          <GlassCard className="p-4">
            <ChampionshipOddsBar summary={sortedSummary} topN={10} flags={flags} />
          </GlassCard>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type ScenarioScore = { score1: number; score2: number }

export function ScenarioBuilder() {
  const [tab, setTab] = useState<'group' | 'knockout'>('group')
  const [scenarios, setScenarios] = useState<Record<string, ScenarioScore>>({})
  const [result, setResult] = useState<WhatIfResponse | null>(null)

  const { data: teamsData, isError: teamsError, refetch: refetchTeams } =
    useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const { data: resultsData, isError: resultsError, refetch: refetchResults } =
    useQuery({ queryKey: ['results'], queryFn: fetchResults })
  const flags = teamsData?.flags ?? {}

  const { mutate: calculate, isPending } = useMutation({
    mutationFn: fetchWhatIf,
    onSuccess: setResult,
    onError: () => toast.error('Scenario calculation failed — is the backend running?'),
  })

  // Per-group: played (locked) and remaining (editable) fixtures
  const fixturesByGroup = useMemo(() => {
    if (!teamsData || !resultsData) return {}

    // Build a map from canonical pair key to actual score (both orderings)
    const playedMap = new Map<string, { score1: number; score2: number }>()
    for (const r of resultsData.group_results) {
      playedMap.set(`${r.team1}|${r.team2}`, { score1: r.score1, score2: r.score2 })
    }

    const out: Record<
      string,
      {
        played: { team1: string; team2: string; score1: number; score2: number }[]
        remaining: { team1: string; team2: string }[]
      }
    > = {}

    for (const [group, teams] of Object.entries(teamsData.groups)) {
      const played: { team1: string; team2: string; score1: number; score2: number }[] = []
      const remaining: { team1: string; team2: string }[] = []

      for (let i = 0; i < teams.length; i++) {
        for (let j = i + 1; j < teams.length; j++) {
          const t1 = teams[i], t2 = teams[j]
          if (playedMap.has(`${t1}|${t2}`)) {
            const { score1, score2 } = playedMap.get(`${t1}|${t2}`)!
            played.push({ team1: t1, team2: t2, score1, score2 })
          } else if (playedMap.has(`${t2}|${t1}`)) {
            const { score1, score2 } = playedMap.get(`${t2}|${t1}`)!
            played.push({ team1: t1, team2: t2, score1: score2, score2: score1 })
          } else {
            remaining.push({ team1: t1, team2: t2 })
          }
        }
      }

      if (remaining.length > 0) {
        out[group] = { played, remaining }
      }
    }

    return out
  }, [teamsData, resultsData])

  const setScore = (t1: string, t2: string, field: 'score1' | 'score2', v: number) => {
    const key = `${t1}|${t2}`
    setScenarios(prev => ({
      ...prev,
      [key]: { ...(prev[key] ?? { score1: 0, score2: 0 }), [field]: v },
    }))
  }

  const handleCalculate = () => {
    const hypo = Object.entries(scenarios).map(([key, s]) => {
      const [team1, team2] = key.split('|')
      return { team1, team2, score1: s.score1, score2: s.score2 }
    })
    calculate({ hypothetical: hypo })
  }

  const handleReset = () => {
    setScenarios({})
    setResult(null)
  }

  const affectedGroups = new Set(
    Object.keys(scenarios).flatMap(key => {
      if (!teamsData) return []
      const [t1] = key.split('|')
      for (const [g, ts] of Object.entries(teamsData.groups)) {
        if (ts.includes(t1)) return [g]
      }
      return []
    })
  )

  const hasAnyScenario = Object.keys(scenarios).length > 0
  const allGroupsComplete = Object.keys(fixturesByGroup).length === 0

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Scenario Builder"
        icon={WandSparkles}
        subtitle={
          tab === 'group'
            ? 'Set hypothetical scores for unplayed group matches to see how standings, the third-place race, and the R32 bracket would look. Played matches are locked.'
            : 'Pick winners for pending knockout matches and re-simulate the tournament with those results forced. Decided matches are locked.'
        }
      />

      {/* Tab switcher */}
      <div className="flex gap-1 p-1 rounded-xl bg-white/[0.04] border border-white/[0.07] w-fit">
        {([['group', 'Group stage'], ['knockout', 'Knockout']] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cn(
              'px-4 py-2 rounded-lg text-xs font-display uppercase tracking-[0.12em] transition-colors cursor-pointer',
              tab === key
                ? 'bg-white/[0.08] text-ink-50 border border-white/[0.10]'
                : 'text-ink-400 hover:text-ink-100 border border-transparent',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'knockout' ? (
        <KnockoutScenario flags={flags} />
      ) : (teamsError || resultsError) ? (
        <QueryError onRetry={() => { refetchTeams(); refetchResults() }} />
      ) : allGroupsComplete ? (
        <GlassCard className="p-6 text-center text-ink-400">
          All group-stage matches have been played — the bracket is set.
        </GlassCard>
      ) : (
        <>
          {/* Fixture editor grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {Object.entries(fixturesByGroup)
              .sort(([a], [b]) => a.localeCompare(b))
              .map(([group, data]) => (
                <GlassCard key={group} className="p-4">
                  <div className="font-display text-sm uppercase tracking-[0.14em] text-gold mb-3">
                    Group {group}
                  </div>

                  {/* Played — locked display */}
                  {data.played.map((r, i) => (
                    <div key={i} className="flex items-center gap-2 py-1.5 text-xs">
                      <div className="flex items-center gap-1 flex-1 min-w-0">
                        <FlagImage code={flags[r.team1]} size={12} />
                        <span className="text-ink-500 truncate">{r.team1}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 font-mono font-bold text-ink-500 text-xs">
                        {r.score1} – {r.score2}
                        <Lock size={10} className="text-ink-600" />
                      </div>
                      <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                        <span className="text-ink-500 truncate">{r.team2}</span>
                        <FlagImage code={flags[r.team2]} size={12} />
                      </div>
                    </div>
                  ))}

                  {/* Remaining — editable */}
                  {data.remaining.map(({ team1, team2 }) => {
                    const key = `${team1}|${team2}`
                    const sc = scenarios[key] ?? { score1: 0, score2: 0 }
                    return (
                      <div key={key} className="flex items-center gap-2 py-1.5">
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <FlagImage code={flags[team1]} size={12} />
                          <span className="text-ink-50 text-xs truncate">{team1}</span>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <ScoreStepper
                            value={sc.score1}
                            onChange={v => setScore(team1, team2, 'score1', v)}
                          />
                          <span className="text-ink-500 text-xs px-0.5">–</span>
                          <ScoreStepper
                            value={sc.score2}
                            onChange={v => setScore(team1, team2, 'score2', v)}
                          />
                        </div>
                        <div className="flex items-center gap-1 flex-1 min-w-0 justify-end">
                          <span className="text-ink-50 text-xs truncate">{team2}</span>
                          <FlagImage code={flags[team2]} size={12} />
                        </div>
                      </div>
                    )
                  })}
                </GlassCard>
              ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              icon={RotateCcw}
              onClick={handleReset}
              disabled={!hasAnyScenario && result === null}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              icon={WandSparkles}
              loading={isPending}
              onClick={handleCalculate}
              disabled={!hasAnyScenario}
            >
              {isPending ? 'Calculating…' : 'Calculate'}
            </Button>
            {hasAnyScenario && !isPending && (
              <span className="text-ink-400 text-xs">
                {Object.keys(scenarios).length} match
                {Object.keys(scenarios).length !== 1 ? 'es' : ''} set across{' '}
                {affectedGroups.size} group{affectedGroups.size !== 1 ? 's' : ''}
              </span>
            )}
          </div>
        </>
      )}

      {/* Results */}
      {result && (
        <div className="space-y-6 border-t border-white/[0.08] pt-6">
          {/* Projected standings */}
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-ink-100 mb-3">
              <ListOrdered size={15} className="text-gold" /> Projected group standings
            </h3>
            {Object.keys(result.standings).length === 0 ? (
              <p className="text-ink-400 text-sm">
                No groups have any results yet — add at least one scenario above.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {Object.entries(result.standings)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([letter, gdata]) => (
                    <WhatIfGroupCard
                      key={letter}
                      letter={letter}
                      gdata={gdata}
                      flags={flags}
                      isAffected={affectedGroups.has(letter)}
                    />
                  ))}
              </div>
            )}
          </div>

          {/* Updated third-place race */}
          <div>
            <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-ink-100 mb-3">
              <Medal size={15} className="text-gold" /> Updated third-place race
            </h3>
            <WhatIfThirds thirds={result.third_place_race} flags={flags} />
          </div>

          {/* R32 projections */}
          {result.r32_projections.length > 0 && (
            <div>
              <h3 className="flex items-center gap-2 font-display text-sm uppercase tracking-[0.14em] text-ink-100 mb-1">
                <GitBranch size={15} className="text-gold" /> Projected R32 bracket
              </h3>
              <p className="text-ink-400 text-xs mb-3">
                Teams shown where group winners / runners-up are already determined.
                Unresolved slots show their qualification path.
              </p>
              <WhatIfR32 projections={result.r32_projections} flags={flags} />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
