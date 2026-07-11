import { useQuery } from '@tanstack/react-query'
import { Trophy, Swords, GitBranch, CircleCheck } from 'lucide-react'
import { fetchFinalFour, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
import { BrandArcPattern } from '../components/shared/BrandArcPattern'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard, SectionCard } from '../components/ui/GlassCard'
import { CardSkeleton } from '../components/ui/Skeleton'
import { QueryError } from '../components/ui/QueryError'
import { EmptyState } from '../components/ui/EmptyState'
import type { FinalFourMatch, FinalFourPairing, FinalFourSemifinal } from '../api/types'

function isPlaceholder(name: string): boolean {
  return /^W\d+$/.test(name)
}

function feederLabel(slot: string, qfs: FinalFourMatch[]): string {
  const m = /^W(\d+)$/.exec(slot)
  if (!m) return slot
  const qf = qfs.find(q => q.match === Number(m[1]))
  return qf ? `Winner of ${qf.team1} vs ${qf.team2}` : `Winner of Match ${m[1]}`
}

function TeamChip({ team, flags, align = 'left' }: { team: string; flags: Record<string, string>; align?: 'left' | 'right' }) {
  return (
    <div className={`flex items-center gap-2 min-w-0 ${align === 'right' ? 'flex-row-reverse text-right' : ''}`}>
      <FlagImage code={flags[team]} size={20} />
      <span className="text-ink-50 font-display uppercase tracking-wide text-sm truncate">{team}</span>
    </div>
  )
}

function CandidateBar({ team, prob, flags }: { team: string; prob: number; flags: Record<string, string> }) {
  return (
    <div className="flex items-center gap-2 text-xs">
      <div className="flex items-center gap-1.5 w-28 shrink-0">
        <FlagImage code={flags[team]} size={12} />
        <span className="text-ink-200 truncate">{team}</span>
      </div>
      <div className="flex-1 relative h-3.5 bg-white/[0.06] rounded overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded bg-host-blue-bright"
          style={{ width: `${Math.max(prob * 100, 1.5)}%` }}
        />
      </div>
      <span className="w-11 text-right font-mono text-ink-300 shrink-0">{(prob * 100).toFixed(1)}%</span>
    </div>
  )
}

function SemifinalCard({
  sf, index, qfs, flags,
}: {
  sf: FinalFourSemifinal
  index: number
  qfs: FinalFourMatch[]
  flags: Record<string, string>
}) {
  const projected = isPlaceholder(sf.team1) || isPlaceholder(sf.team2)

  return (
    <GlassCard className="p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="font-display text-sm uppercase tracking-[0.14em] text-gold">
          Semifinal {index}
        </div>
        {sf.actual && (
          <span className="flex items-center gap-1 text-[11px] font-semibold text-host-green uppercase tracking-wide">
            <CircleCheck size={12} /> Decided
          </span>
        )}
      </div>

      {sf.actual ? (
        <div className="flex items-center justify-between gap-2">
          <TeamChip team={sf.team1} flags={flags} />
          <span className="text-ink-500 text-xs uppercase shrink-0">vs</span>
          <TeamChip team={sf.team2} flags={flags} align="right" />
        </div>
      ) : projected ? (
        <>
          <p className="text-[11px] text-ink-500 mb-3">
            {feederLabel(sf.team1, qfs)} vs {feederLabel(sf.team2, qfs)}
          </p>
          <div className="space-y-1.5">
            {sf.candidates.map(c => (
              <CandidateBar key={c.team} team={c.team} prob={c.prob} flags={flags} />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="flex items-center justify-between gap-2 mb-3">
            <TeamChip team={sf.team1} flags={flags} />
            <span className="text-ink-500 text-xs uppercase shrink-0">vs</span>
            <TeamChip team={sf.team2} flags={flags} align="right" />
          </div>
          <div className="space-y-1.5">
            {sf.candidates.map(c => (
              <CandidateBar key={c.team} team={c.team} prob={c.prob} flags={flags} />
            ))}
          </div>
        </>
      )}
    </GlassCard>
  )
}

function PairingRow({ p, isTop, flags }: { p: FinalFourPairing; isTop: boolean; flags: Record<string, string> }) {
  return (
    <tr className={`border-b border-white/[0.05] ${isTop ? 'bg-gold/[0.06]' : ''}`}>
      <td className="py-2.5 pr-3">
        <div className="flex items-center gap-2 flex-wrap">
          <FlagImage code={flags[p.team1]} size={14} />
          <span className="text-ink-50 font-medium">{p.team1}</span>
          <span className="text-ink-500 text-[10px] uppercase">vs</span>
          <span className="text-ink-50 font-medium">{p.team2}</span>
          <FlagImage code={flags[p.team2]} size={14} />
          {isTop && (
            <span className="text-[9px] font-bold uppercase tracking-wide text-gold px-1.5 py-0.5 rounded-full bg-gold/15 border border-gold/30">
              Most likely
            </span>
          )}
        </div>
      </td>
      <td className="py-2.5 px-3 text-right font-mono text-ink-100">
        {(p.pairing_prob * 100).toFixed(1)}%
      </td>
      <td className="py-2.5 px-3">
        <div className="flex items-center gap-1.5 w-40">
          <div className="flex-1 relative h-3.5 bg-white/[0.06] rounded overflow-hidden flex">
            <div className="bg-host-blue-bright h-full" style={{ width: `${p.p_team1_win_final * 100}%` }} />
            <div className="bg-host-red h-full" style={{ width: `${(1 - p.p_team1_win_final) * 100}%` }} />
          </div>
        </div>
        <div className="flex justify-between text-[10px] text-ink-500 mt-0.5 w-40">
          <span>{p.team1} {(p.p_team1_win_final * 100).toFixed(0)}%</span>
          <span>{p.team2} {((1 - p.p_team1_win_final) * 100).toFixed(0)}%</span>
        </div>
      </td>
      <td className="py-2.5 pl-3 text-right text-ink-400 text-xs whitespace-nowrap">
        {p.h2h.total > 0
          ? `${p.h2h.team1_wins}-${p.h2h.draws}-${p.h2h.team2_wins}`
          : 'No history'}
      </td>
    </tr>
  )
}

export function FinalFour() {
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const flags = teamsData?.flags ?? {}

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['final-four'],
    queryFn: fetchFinalFour,
    staleTime: 120_000,
    refetchInterval: 120_000,
  })

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Final Four"
        icon={Trophy}
        subtitle="The path to the final — semifinal matchups (or the quarterfinals still deciding them), and every possible final pairing ranked by likelihood."
      />

      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <CardSkeleton lines={4} />
          <CardSkeleton lines={4} />
        </div>
      )}

      {isError && <QueryError onRetry={() => refetch()} />}

      {data && (
        <>
          {data.final_decided && data.champion && (
            <GlassCard className="border-beam relative overflow-hidden p-6 sm:p-8 text-center">
              <BrandArcPattern variant="full" opacity={0.1} className="absolute inset-0 w-full h-full pointer-events-none" />
              <div className="relative flex flex-col items-center gap-2">
                <Trophy size={32} className="text-gold" strokeWidth={1.8} />
                <FlagImage code={flags[data.champion]} size={40} />
                <div className="font-display text-3xl uppercase tracking-wide text-ink-50">
                  {data.champion}
                </div>
                <div className="text-xs uppercase tracking-[0.25em] text-gold font-semibold">
                  2026 FIFA World Cup Champions
                </div>
              </div>
            </GlassCard>
          )}

          <SectionCard icon={Swords} accent="blue" title="Semifinals">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {data.semifinals.map((sf, i) => (
                <SemifinalCard
                  key={sf.match}
                  sf={sf}
                  index={i + 1}
                  qfs={data.quarterfinals}
                  flags={flags}
                />
              ))}
            </div>
          </SectionCard>

          {data.pairings.length > 0 ? (
            <SectionCard
              icon={GitBranch}
              accent="gold"
              title={`Possible finals (${data.pairings.length})`}
            >
              <p className="text-xs text-ink-400 mb-3">
                Every remaining combination of finalists, how likely each is, who's favored if it
                happens, and the all-time head-to-head.
              </p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[560px]">
                  <thead>
                    <tr className="text-ink-400 border-b border-white/[0.08] text-[10px] uppercase tracking-wider">
                      <th className="text-left py-1.5 pr-3 font-semibold">Final</th>
                      <th className="text-right py-1.5 px-3 font-semibold">Likelihood</th>
                      <th className="text-left py-1.5 px-3 font-semibold">If it happens</th>
                      <th className="text-right py-1.5 pl-3 font-semibold">H2H (W-D-L)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.pairings.map((p, i) => (
                      <PairingRow key={`${p.team1}|${p.team2}`} p={p} isTop={i === 0} flags={flags} />
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          ) : (
            <EmptyState
              icon={GitBranch}
              title="Possible finals not yet known"
              hint="Check back once at least one semifinal side is set."
            />
          )}
        </>
      )}
    </div>
  )
}
