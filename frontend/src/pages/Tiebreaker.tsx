import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Scale, Medal, AlertTriangle, CircleCheck, ArrowUp, ArrowDown } from 'lucide-react'
import { fetchTiebreaker, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard } from '../components/ui/GlassCard'
import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { cn } from '../utils/cn'
import type { TiebreakerRow, TiebreakerGroup } from '../api/types'

type Outcome = 'home_win' | 'draw' | 'away_win'

const OUTCOME_COLORS: Record<Outcome, string> = {
  home_win: 'var(--color-host-blue-bright)',
  draw: 'var(--color-ink-500)',
  away_win: 'var(--color-host-red)',
}

// Row tints: qualified = host blue, third place = gold
const QUALIFIED_BG = 'rgba(42,57,141,0.18)'
const THIRD_BG = 'rgba(212,175,55,0.12)'

function RankDelta({ before, after }: { before: number; after: number }) {
  const d = before - after // positive = moved up
  if (d > 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-host-green">
      <ArrowUp size={11} />{d}
    </span>
  )
  if (d < 0) return (
    <span className="inline-flex items-center gap-0.5 text-xs font-bold text-host-red">
      <ArrowDown size={11} />{Math.abs(d)}
    </span>
  )
  return <span className="text-ink-500 text-xs">–</span>
}

function StandingsTable({
  rows,
  baseline,
  flags,
}: {
  rows: TiebreakerRow[]
  baseline: TiebreakerRow[]
  flags: Record<string, string>
}) {
  const baseRank: Record<string, number> = {}
  for (const r of baseline) baseRank[r.team] = r.rank

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-[10px] uppercase tracking-wider text-ink-400 border-b border-white/[0.08]">
          <th className="text-left py-1 font-semibold">#</th>
          <th className="text-left py-1 font-semibold">Team</th>
          <th className="text-right py-1 font-semibold">Pts</th>
          <th className="text-right py-1 font-semibold">GD</th>
          <th className="text-right py-1 font-semibold">GF</th>
          <th className="text-right py-1 font-semibold">Δ</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => {
          const isQ = i < 2
          const is3rd = i === 2
          return (
            <tr key={r.team}
              className="border-b border-white/[0.05]"
              style={{ backgroundColor: isQ ? QUALIFIED_BG : is3rd ? THIRD_BG : undefined }}
            >
              <td className="py-1.5 pr-2">
                <span className="text-ink-500 text-xs font-mono">{r.rank}</span>
              </td>
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[r.team]} size={16} />
                  <span className={cn('text-sm', isQ ? 'text-ink-50 font-semibold' : 'text-ink-200')}>
                    {r.team}
                  </span>
                  {isQ && (
                    <span className="inline-flex items-center gap-0.5 text-[9px] font-bold ml-1 text-host-green">
                      <CircleCheck size={10} /> Q
                    </span>
                  )}
                  {is3rd && <Medal size={11} className="text-gold ml-1" />}
                </div>
              </td>
              <td className="py-1.5 text-right font-mono font-bold text-ink-50">{r.pts}</td>
              <td
                className="py-1.5 text-right font-mono text-xs"
                style={{ color: r.gd > 0 ? 'var(--color-host-green)' : r.gd < 0 ? 'var(--color-host-red)' : 'var(--color-ink-400)' }}
              >
                {r.gd > 0 ? '+' : ''}{r.gd}
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-ink-400">{r.gf}</td>
              <td className="py-1.5 text-right">
                <RankDelta before={baseRank[r.team] ?? r.rank} after={r.rank} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

function GroupCard({ letter, group, flags }: {
  letter: string
  group: TiebreakerGroup
  flags: Record<string, string>
}) {
  const [selectedFixture, setSelectedFixture] = useState(0)
  const [selectedOutcome, setSelectedOutcome] = useState<Outcome>('home_win')

  const fixture = group.fixtures[selectedFixture]
  const scenarioRows = fixture?.scenarios[selectedOutcome] ?? []

  return (
    <GlassCard className="overflow-hidden">
      {/* Group header */}
      <div className="px-4 sm:px-5 py-3.5 flex items-center justify-between gap-2 flex-wrap bg-white/[0.03] border-b border-white/[0.07]">
        <div className="flex items-center gap-3">
          <span className="font-display text-lg uppercase tracking-[0.1em] text-ink-50">Group {letter}</span>
          <span className="text-xs text-ink-400">
            {group.games_played}/6 played · {group.games_remaining} remaining
          </span>
        </div>
        {group.tied_pairs.length > 0 && (
          <span className="inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full font-semibold bg-warning-bg text-warning border border-warning/25">
            <AlertTriangle size={11} /> Tiebreaker active
          </span>
        )}
      </div>

      <div className="p-4 sm:p-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Current standings */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2">
            Current standings
          </div>
          <StandingsTable rows={group.current_standings} baseline={group.current_standings} flags={flags} />
        </div>

        {/* Scenario calculator */}
        <div>
          <div className="text-[11px] uppercase tracking-[0.16em] font-semibold text-ink-400 mb-2">
            Scenario: what if…
          </div>

          {/* Fixture selector (if multiple remaining) */}
          {group.fixtures.length > 1 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {group.fixtures.map((f, i) => (
                <button key={i}
                  onClick={() => setSelectedFixture(i)}
                  className={cn(
                    'text-xs px-2.5 py-1.5 min-h-8 rounded-lg font-medium transition-colors cursor-pointer border',
                    selectedFixture === i
                      ? 'bg-host-blue-bright text-white border-host-blue-bright'
                      : 'bg-white/[0.05] text-ink-300 border-[var(--glass-border)] hover:bg-white/[0.10]',
                  )}
                >
                  {f.team1} vs {f.team2}
                </button>
              ))}
            </div>
          )}

          {/* Match being analysed */}
          {fixture && (
            <>
              <div className="flex items-center justify-center gap-3 py-2.5 mb-3 rounded-xl bg-ink-950/50 border border-white/[0.06]">
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[fixture.team1]} size={18} />
                  <span className="text-sm font-semibold text-ink-50">{fixture.team1}</span>
                </div>
                <span className="font-display text-xs text-gold">VS</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-ink-50">{fixture.team2}</span>
                  <FlagImage code={flags[fixture.team2]} size={18} />
                </div>
              </div>

              {/* Outcome tabs — blue / glass / red segmented control */}
              <div className="flex rounded-xl overflow-hidden mb-3 border border-[var(--glass-border)]">
                {(['home_win', 'draw', 'away_win'] as Outcome[]).map(o => (
                  <button key={o}
                    onClick={() => setSelectedOutcome(o)}
                    className="flex-1 py-2 min-h-9 text-xs font-semibold transition-colors cursor-pointer"
                    style={{
                      backgroundColor: selectedOutcome === o ? OUTCOME_COLORS[o] : 'transparent',
                      color: selectedOutcome === o ? '#fff' : 'var(--color-ink-400)',
                    }}
                  >
                    {o === 'home_win' ? fixture.team1.split(' ')[0]
                      : o === 'away_win' ? fixture.team2.split(' ')[0]
                        : 'Draw'}
                    {' '}
                    {o === 'home_win' || o === 'away_win' ? 'Wins' : ''}
                  </button>
                ))}
              </div>

              {/* Projected standings */}
              <StandingsTable
                rows={scenarioRows}
                baseline={group.current_standings}
                flags={flags}
              />
              <p className="text-[10px] text-ink-500 mt-2">
                Q = auto-qualify for R32 · medal = enters best-third race · Δ = rank change vs current
              </p>
            </>
          )}
        </div>
      </div>
    </GlassCard>
  )
}

export function Tiebreaker() {
  const { data, isLoading } = useQuery({
    queryKey: ['tiebreaker'],
    queryFn: fetchTiebreaker,
    staleTime: 120_000,
    refetchInterval: 120_000,
  })
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const flags = teamsData?.flags ?? {}

  if (isLoading) {
    return (
      <div className="stagger space-y-5">
        <PageHeader title="Tiebreakers" icon={Scale} subtitle="Computing scenarios…" />
        <CardSkeleton lines={5} />
      </div>
    )
  }

  const activeGroups = data?.active_groups ?? {}
  const allGroups = data?.groups ?? {}
  const hasActive = Object.keys(activeGroups).length > 0

  return (
    <div className="stagger space-y-5">
      <PageHeader
        title="Tiebreakers"
        icon={Scale}
        subtitle="Select a remaining fixture and outcome to see projected group standings."
      />

      {!hasActive ? (
        /* All groups complete — show retrospective summary */
        <div className="space-y-4">
          <EmptyState
            icon={CircleCheck}
            title="All group stage matches complete"
            hint="Below are the final group standings. Tiebreakers were applied where teams finished level on points."
          />

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(allGroups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
              <GlassCard key={letter} hover accent="gold" className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-display text-base uppercase tracking-[0.1em] text-ink-50">Group {letter}</span>
                  {group.tied_pairs.length > 0 && (
                    <span className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-warning-bg text-warning border border-warning/25">
                      <Scale size={10} /> Tiebreaker applied
                    </span>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1 font-semibold">#</th>
                      <th className="text-left py-1 font-semibold">Team</th>
                      <th className="text-right py-1 font-semibold">Pts</th>
                      <th className="text-right py-1 font-semibold">GD</th>
                      <th className="text-right py-1 font-semibold">GF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.current_standings.map((r, i) => (
                      <tr key={r.team}
                        className="border-b border-white/[0.05]"
                        style={{ backgroundColor: i < 2 ? QUALIFIED_BG : i === 2 ? THIRD_BG : undefined }}>
                        <td className="py-1.5 text-ink-500">{r.rank}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <FlagImage code={flags[r.team]} size={14} />
                            <span className={i < 2 ? 'text-ink-50 font-semibold' : 'text-ink-200'}>{r.team}</span>
                            {i < 2 && <CircleCheck size={10} className="text-host-green" />}
                            {i === 2 && <Medal size={10} className="text-gold" />}
                          </div>
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold text-ink-50">{r.pts}</td>
                        <td
                          className="py-1.5 text-right font-mono"
                          style={{ color: r.gd > 0 ? 'var(--color-host-green)' : r.gd < 0 ? 'var(--color-host-red)' : 'var(--color-ink-400)' }}
                        >
                          {r.gd > 0 ? '+' : ''}{r.gd}
                        </td>
                        <td className="py-1.5 text-right font-mono text-ink-400">{r.gf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {group.tied_pairs.length > 0 && (
                  <p className="text-[10px] text-ink-500 mt-2">
                    {group.tied_pairs.map(p => p.join(' & ')).join('; ')} separated by tiebreaker
                  </p>
                )}
              </GlassCard>
            ))}
          </div>
        </div>
      ) : (
        /* Active groups — show scenario calculators */
        <div className="space-y-5">
          {Object.entries(activeGroups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
            <GroupCard key={letter} letter={letter} group={group} flags={flags} />
          ))}
        </div>
      )}
    </div>
  )
}
