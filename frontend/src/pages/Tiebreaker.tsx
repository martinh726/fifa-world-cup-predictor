import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchTiebreaker, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
import type { TiebreakerRow, TiebreakerGroup } from '../api/types'

type Outcome = 'home_win' | 'draw' | 'away_win'

const OUTCOME_LABELS: Record<Outcome, string> = {
  home_win: 'Home Win',
  draw: 'Draw',
  away_win: 'Away Win',
}

const OUTCOME_COLORS: Record<Outcome, string> = {
  home_win: 'var(--color-wc-blue)',
  draw: 'var(--color-slate-500)',
  away_win: 'var(--color-wc-red)',
}

function RankDelta({ before, after }: { before: number; after: number }) {
  const d = before - after // positive = moved up
  if (d > 0) return <span className="text-xs font-bold" style={{ color: 'var(--color-success)' }}>▲{d}</span>
  if (d < 0) return <span className="text-xs font-bold" style={{ color: 'var(--color-danger)' }}>▼{Math.abs(d)}</span>
  return <span className="text-slate-400 text-xs">–</span>
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
        <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-200">
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
              className="border-b border-slate-100"
              style={{
                backgroundColor: isQ
                  ? 'rgba(15,63,163,0.07)'
                  : is3rd
                    ? 'rgba(201,150,42,0.08)'
                    : undefined,
              }}
            >
              <td className="py-1.5 pr-2">
                <span className="text-slate-500 text-xs font-mono">{r.rank}</span>
              </td>
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[r.team]} size={16} />
                  <span className={`text-sm ${isQ ? 'text-slate-900 font-semibold' : 'text-slate-700'}`}>
                    {r.team}
                  </span>
                  {isQ && <span className="text-[9px] font-bold ml-1" style={{ color: 'var(--color-success)' }}>✓ Q</span>}
                  {is3rd && <span className="text-[9px]" style={{ color: 'var(--color-wc-gold)' }}>🏅</span>}
                </div>
              </td>
              <td className="py-1.5 text-right font-mono font-bold text-slate-900">{r.pts}</td>
              <td
                className="py-1.5 text-right font-mono text-xs"
                style={{ color: r.gd > 0 ? 'var(--color-success)' : r.gd < 0 ? 'var(--color-danger)' : 'var(--color-slate-500)' }}
              >
                {r.gd > 0 ? '+' : ''}{r.gd}
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-slate-500">{r.gf}</td>
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
    <div className="rounded-xl overflow-hidden bg-white border border-slate-200 shadow-sm">
      {/* Group header */}
      <div className="px-4 py-3 flex items-center justify-between bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-slate-900">Group {letter}</span>
          <span className="text-xs text-slate-500">
            {group.games_played}/6 played · {group.games_remaining} remaining
          </span>
        </div>
        {group.tied_pairs.length > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
          >
            ⚠ Tiebreaker active
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current standings */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Current standings
          </div>
          <StandingsTable rows={group.current_standings} baseline={group.current_standings} flags={flags} />
        </div>

        {/* Scenario calculator */}
        <div>
          <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
            Scenario: what if…
          </div>

          {/* Fixture selector (if multiple remaining) */}
          {group.fixtures.length > 1 && (
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {group.fixtures.map((f, i) => (
                <button key={i}
                  onClick={() => setSelectedFixture(i)}
                  className="text-xs px-2 py-1 rounded font-medium transition-colors"
                  style={{
                    backgroundColor: selectedFixture === i ? 'var(--color-wc-blue)' : 'var(--color-slate-100)',
                    color: selectedFixture === i ? '#fff' : 'var(--color-slate-600)',
                    border: `1px solid ${selectedFixture === i ? 'var(--color-wc-blue)' : 'var(--color-slate-300)'}`,
                  }}
                >
                  {f.team1} vs {f.team2}
                </button>
              ))}
            </div>
          )}

          {/* Match being analysed */}
          {fixture && (
            <>
              <div className="flex items-center justify-center gap-3 py-2 mb-3 rounded-lg bg-slate-50">
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[fixture.team1]} size={18} />
                  <span className="text-sm font-semibold text-slate-900">{fixture.team1}</span>
                </div>
                <span className="text-slate-500 font-bold text-sm">vs</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-slate-900">{fixture.team2}</span>
                  <FlagImage code={flags[fixture.team2]} size={18} />
                </div>
              </div>

              {/* Outcome tabs */}
              <div className="flex rounded-lg overflow-hidden mb-3 border border-slate-300">
                {(['home_win', 'draw', 'away_win'] as Outcome[]).map(o => (
                  <button key={o}
                    onClick={() => setSelectedOutcome(o)}
                    className="flex-1 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: selectedOutcome === o ? OUTCOME_COLORS[o] : 'transparent',
                      color: selectedOutcome === o ? '#fff' : 'var(--color-slate-500)',
                    }}
                  >
                    {o === 'home_win' ? fixture.team1.split(' ')[0]
                      : o === 'away_win' ? fixture.team2.split(' ')[0]
                        : 'Draw'}
                    {' '}
                    {o === 'home_win' ? 'Wins' : o === 'away_win' ? 'Wins' : ''}
                  </button>
                ))}
              </div>

              {/* Projected standings */}
              <StandingsTable
                rows={scenarioRows}
                baseline={group.current_standings}
                flags={flags}
              />
              <p className="text-[10px] text-slate-500 mt-2">
                ✓ Q = auto-qualify for R32 · 🏅 = enters best-third race · Δ = rank change vs current
              </p>
            </>
          )}
        </div>
      </div>
    </div>
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
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Computing scenarios…
      </div>
    )
  }

  const activeGroups = data?.active_groups ?? {}
  const allGroups = data?.groups ?? {}
  const hasActive = Object.keys(activeGroups).length > 0

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-slate-900">Group Tiebreaker Calculator</h2>
        <p className="text-xs text-slate-500 mt-0.5">
          Select a remaining fixture and outcome to see projected group standings
        </p>
      </div>

      {!hasActive ? (
        /* All groups complete — show retrospective summary */
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 shadow-sm rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-slate-900 font-semibold mb-1">All group stage matches complete</div>
            <div className="text-slate-500 text-sm">
              Below are the final group standings. Tiebreakers were applied where teams finished level on points.
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(allGroups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
              <div key={letter} className="rounded-xl p-4 bg-white border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-3">
                  <span className="font-black text-slate-900 text-base">Group {letter}</span>
                  {group.tied_pairs.length > 0 && (
                    <span
                      className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)' }}
                    >
                      ⚖ Tiebreaker applied
                    </span>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-200 text-[10px] uppercase">
                      <th className="text-left py-1">#</th>
                      <th className="text-left py-1">Team</th>
                      <th className="text-right py-1">Pts</th>
                      <th className="text-right py-1">GD</th>
                      <th className="text-right py-1">GF</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.current_standings.map((r, i) => (
                      <tr key={r.team}
                        className="border-b border-slate-100"
                        style={{ backgroundColor: i < 2 ? 'rgba(15,63,163,0.07)' : i === 2 ? 'rgba(201,150,42,0.08)' : undefined }}>
                        <td className="py-1.5 text-slate-500">{r.rank}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <FlagImage code={flags[r.team]} size={14} />
                            <span className={i < 2 ? 'text-slate-900 font-semibold' : 'text-slate-700'}>{r.team}</span>
                            {i < 2 && <span className="text-[9px] font-bold" style={{ color: 'var(--color-success)' }}>✓</span>}
                            {i === 2 && <span className="text-[9px]" style={{ color: 'var(--color-wc-gold)' }}>🏅</span>}
                          </div>
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-900">{r.pts}</td>
                        <td
                          className="py-1.5 text-right font-mono"
                          style={{ color: r.gd > 0 ? 'var(--color-success)' : r.gd < 0 ? 'var(--color-danger)' : 'var(--color-slate-500)' }}
                        >
                          {r.gd > 0 ? '+' : ''}{r.gd}
                        </td>
                        <td className="py-1.5 text-right font-mono text-slate-500">{r.gf}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {group.tied_pairs.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-2">
                    ⚖ {group.tied_pairs.map(p => p.join(' & ')).join('; ')} separated by tiebreaker
                  </p>
                )}
              </div>
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
