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
  home_win: '#003087',
  draw: '#475569',
  away_win: '#c41230',
}

function RankDelta({ before, after }: { before: number; after: number }) {
  const d = before - after // positive = moved up
  if (d > 0) return <span className="text-green-400 text-xs font-bold">▲{d}</span>
  if (d < 0) return <span className="text-red-400 text-xs font-bold">▼{Math.abs(d)}</span>
  return <span className="text-slate-500 text-xs">–</span>
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
        <tr className="text-[10px] uppercase text-slate-500 border-b border-slate-700">
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
              className="border-b border-slate-700/40"
              style={{
                backgroundColor: isQ
                  ? 'rgba(0,48,135,0.15)'
                  : is3rd
                    ? 'rgba(201,162,39,0.06)'
                    : undefined,
              }}
            >
              <td className="py-1.5 pr-2">
                <span className="text-slate-400 text-xs font-mono">{r.rank}</span>
              </td>
              <td className="py-1.5">
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[r.team]} size={16} />
                  <span className={`text-sm ${isQ ? 'text-white font-semibold' : 'text-slate-300'}`}>
                    {r.team}
                  </span>
                  {isQ && <span className="text-[9px] text-green-400 font-bold ml-1">✓ Q</span>}
                  {is3rd && <span className="text-[9px]" style={{ color: '#c9a227' }}>🏅</span>}
                </div>
              </td>
              <td className="py-1.5 text-right font-mono font-bold text-slate-200">{r.pts}</td>
              <td className={`py-1.5 text-right font-mono text-xs ${r.gd > 0 ? 'text-green-400' : r.gd < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                {r.gd > 0 ? '+' : ''}{r.gd}
              </td>
              <td className="py-1.5 text-right font-mono text-xs text-slate-400">{r.gf}</td>
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
    <div className="rounded-xl overflow-hidden"
      style={{ border: '1px solid rgba(201,162,39,0.15)', backgroundColor: '#050c1c' }}>
      {/* Group header */}
      <div className="px-4 py-3 flex items-center justify-between"
        style={{ backgroundColor: '#09142a', borderBottom: '1px solid rgba(201,162,39,0.1)' }}>
        <div className="flex items-center gap-3">
          <span className="text-lg font-black text-white">Group {letter}</span>
          <span className="text-xs text-slate-400">
            {group.games_played}/6 played · {group.games_remaining} remaining
          </span>
        </div>
        {group.tied_pairs.length > 0 && (
          <span className="text-xs px-2 py-0.5 rounded-full font-semibold"
            style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
            ⚠ Tiebreaker active
          </span>
        )}
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Current standings */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Current standings
          </div>
          <StandingsTable rows={group.current_standings} baseline={group.current_standings} flags={flags} />
        </div>

        {/* Scenario calculator */}
        <div>
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
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
                    backgroundColor: selectedFixture === i ? '#003087' : '#0f2040',
                    color: selectedFixture === i ? '#fff' : '#90aacb',
                    border: `1px solid ${selectedFixture === i ? '#5b8fd4' : '#1a3060'}`,
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
              <div className="flex items-center justify-center gap-3 py-2 mb-3 rounded-lg"
                style={{ backgroundColor: '#0f2040' }}>
                <div className="flex items-center gap-1.5">
                  <FlagImage code={flags[fixture.team1]} size={18} />
                  <span className="text-sm font-semibold text-white">{fixture.team1}</span>
                </div>
                <span className="text-slate-500 font-bold text-sm">vs</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-white">{fixture.team2}</span>
                  <FlagImage code={flags[fixture.team2]} size={18} />
                </div>
              </div>

              {/* Outcome tabs */}
              <div className="flex rounded-lg overflow-hidden mb-3"
                style={{ border: '1px solid #1a3060' }}>
                {(['home_win', 'draw', 'away_win'] as Outcome[]).map(o => (
                  <button key={o}
                    onClick={() => setSelectedOutcome(o)}
                    className="flex-1 py-1.5 text-xs font-semibold transition-colors"
                    style={{
                      backgroundColor: selectedOutcome === o ? OUTCOME_COLORS[o] : 'transparent',
                      color: selectedOutcome === o ? '#fff' : '#5878a8',
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
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
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
        <h2 className="text-lg font-bold text-white">Group Tiebreaker Calculator</h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Select a remaining fixture and outcome to see projected group standings
        </p>
      </div>

      {!hasActive ? (
        /* All groups complete — show retrospective summary */
        <div className="space-y-4">
          <div className="bg-slate-800 rounded-xl p-5 text-center">
            <div className="text-3xl mb-2">✅</div>
            <div className="text-white font-semibold mb-1">All group stage matches complete</div>
            <div className="text-slate-400 text-sm">
              Below are the final group standings. Tiebreakers were applied where teams finished level on points.
            </div>
          </div>

          <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-3">
            {Object.entries(allGroups).sort(([a], [b]) => a.localeCompare(b)).map(([letter, group]) => (
              <div key={letter} className="rounded-xl p-4"
                style={{ backgroundColor: '#09142a', border: '1px solid rgba(201,162,39,0.12)' }}>
                <div className="flex items-center justify-between mb-3">
                  <span className="font-black text-white text-base">Group {letter}</span>
                  {group.tied_pairs.length > 0 && (
                    <span className="text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: 'rgba(245,158,11,0.15)', color: '#f59e0b' }}>
                      ⚖ Tiebreaker applied
                    </span>
                  )}
                </div>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-500 border-b border-slate-700 text-[10px] uppercase">
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
                        className="border-b border-slate-700/40"
                        style={{ backgroundColor: i < 2 ? 'rgba(0,48,135,0.15)' : i === 2 ? 'rgba(201,162,39,0.06)' : undefined }}>
                        <td className="py-1.5 text-slate-500">{r.rank}</td>
                        <td className="py-1.5">
                          <div className="flex items-center gap-1.5">
                            <FlagImage code={flags[r.team]} size={14} />
                            <span className={i < 2 ? 'text-white font-semibold' : 'text-slate-300'}>{r.team}</span>
                            {i < 2 && <span className="text-[9px] text-green-400 font-bold">✓</span>}
                            {i === 2 && <span className="text-[9px]" style={{ color: '#c9a227' }}>🏅</span>}
                          </div>
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold text-slate-200">{r.pts}</td>
                        <td className={`py-1.5 text-right font-mono ${r.gd > 0 ? 'text-green-400' : r.gd < 0 ? 'text-red-400' : 'text-slate-500'}`}>
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
