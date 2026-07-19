import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Radio, Zap, CalendarClock, Info } from 'lucide-react'
import { useLivePolling } from '../hooks/useLivePolling'
import { useAppStore } from '../store/useAppStore'
import { FlagImage } from '../components/shared/FlagImage'
import { WinProbTimeline } from '../components/charts/WinProbTimeline'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard } from '../components/ui/GlassCard'
import { Collapsible } from '../components/ui/Collapsible'
import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { QueryError } from '../components/ui/QueryError'
import { fetchTeams } from '../api'
import { formatLocalTime } from '../utils/time'
import type { MatchStats } from '../api/types'

function ProbBadge({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-[11px] uppercase tracking-[0.14em] text-ink-400">{label}</div>
      <div className="font-display text-2xl mt-0.5" style={{ color }}>{(value * 100).toFixed(0)}%</div>
    </div>
  )
}

function StatRow({
  label, home, away, higherIsBetter = true, format = (v: number) => String(v),
}: {
  label: string
  home: number | null
  away: number | null
  higherIsBetter?: boolean
  format?: (v: number) => string
}) {
  if (home == null && away == null) return null
  const h = home ?? 0, a = away ?? 0
  const homeWins = higherIsBetter ? h > a : h < a
  const awayWins = higherIsBetter ? a > h : a < h
  return (
    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
      <div className="text-right font-semibold" style={{ color: homeWins ? 'var(--color-host-blue-bright)' : 'var(--color-ink-500)' }}>
        {home != null ? format(home) : '–'}
      </div>
      <div className="text-center text-[11px] text-ink-400 whitespace-nowrap px-2">{label}</div>
      <div className="font-semibold" style={{ color: awayWins ? 'var(--color-host-red)' : 'var(--color-ink-500)' }}>
        {away != null ? format(away) : '–'}
      </div>
    </div>
  )
}

function PossessionBar({ home, away }: { home: number | null; away: number | null }) {
  if (home == null || away == null) return null
  return (
    <div className="space-y-1">
      <div className="text-[11px] text-ink-400 text-center uppercase tracking-[0.14em]">Possession</div>
      <div className="flex h-4 rounded-full overflow-hidden text-[10px] font-bold">
        <div
          className="flex items-center justify-end pr-1.5 text-white transition-all"
          style={{ width: `${home}%`, backgroundColor: 'var(--color-host-blue-bright)' }}
        >
          {home > 15 ? `${home}%` : ''}
        </div>
        <div
          className="flex items-center pl-1.5 text-white transition-all"
          style={{ width: `${away}%`, backgroundColor: 'var(--color-host-red)' }}
        >
          {away > 15 ? `${away}%` : ''}
        </div>
      </div>
    </div>
  )
}

function MatchStatsPanel({ stats, home, away }: { stats: MatchStats; home: string; away: string }) {
  const h = stats.home
  const a = stats.away
  return (
    <div className="rounded-xl px-4 py-3.5 space-y-3 bg-ink-950/50 border border-white/[0.06]">
      {/* Team labels */}
      <div className="grid grid-cols-[1fr_auto_1fr] text-[11px] font-bold uppercase tracking-wide">
        <div className="text-right text-host-blue-bright truncate">{home}</div>
        <div className="px-2 text-ink-500">Stats</div>
        <div className="text-host-red truncate">{away}</div>
      </div>

      <PossessionBar home={h.possession} away={a.possession} />

      <div className="space-y-1.5 pt-1">
        <StatRow label="Shots on target" home={h.shots_on_target} away={a.shots_on_target} />
        <StatRow label="Total shots" home={h.total_shots} away={a.total_shots} />
        {(h.xg != null || a.xg != null) && (
          <StatRow label="xG" home={h.xg} away={a.xg} format={v => v.toFixed(2)} />
        )}
        <StatRow label="Saves" home={h.saves} away={a.saves} />

        <div className="h-px my-1 bg-white/[0.07]" />

        <StatRow label="Passes" home={h.passes} away={a.passes} />
        {(h.passes_accurate != null || a.passes_accurate != null) && (
          <StatRow label="Accurate passes" home={h.passes_accurate} away={a.passes_accurate} />
        )}

        <div className="h-px my-1 bg-white/[0.07]" />

        <StatRow label="Corners" home={h.corners} away={a.corners} />
        <StatRow label="Fouls" home={h.fouls} away={a.fouls} higherIsBetter={false} />
        <StatRow label="Yellow cards" home={h.yellow_cards} away={a.yellow_cards} higherIsBetter={false} />
        {(h.red_cards != null && h.red_cards > 0) || (a.red_cards != null && a.red_cards > 0) ? (
          <StatRow label="Red cards" home={h.red_cards} away={a.red_cards} higherIsBetter={false} />
        ) : null}
      </div>
    </div>
  )
}

function LiveBadge({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-host-red/15 border border-host-red/40 text-host-red text-[11px] font-bold uppercase tracking-[0.18em]">
      <span
        className="w-1.5 h-1.5 rounded-full bg-host-red"
        style={{ animation: 'pulse-live 1.6s ease-in-out infinite' }}
      />
      {label}
    </span>
  )
}

export function Live() {
  const { data, isLoading, isError, refetch, dataUpdatedAt } = useLivePolling()
  const { appendWpaPoint, clearStaleWpaKeys, wpaHistory } = useAppStore()
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const flags = teamsData?.flags ?? {}

  const matches = data?.matches ?? []
  const upcoming = data?.todays_upcoming ?? []

  // Append WPA points from live data
  useEffect(() => {
    if (!matches.length) return
    const activeKeys = matches.map(m => `${m.home}v${m.away}`)
    clearStaleWpaKeys(activeKeys)
    for (const m of matches) {
      if (!m.live_probs) continue
      const key = `${m.home}v${m.away}`
      appendWpaPoint(key, {
        minute: m.minute,
        p_home: m.live_probs.p_home,
        p_draw: m.live_probs.p_draw,
        p_away: m.live_probs.p_away,
      })
    }
  }, [dataUpdatedAt])

  const age = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : null

  return (
    <div className="stagger space-y-5">
      <PageHeader
        title="Live"
        icon={Radio}
        subtitle={`Auto-refreshes every 30s${age !== null ? ` · updated ${age}s ago` : ''}`}
        actions={
          <>
            {matches.length > 0 && <LiveBadge label="Live" />}
            {data?.error && (
              <span className="flex items-center gap-1.5 text-xs text-warning">
                <Info size={13} /> {data.error}
              </span>
            )}
          </>
        }
      />

      {isLoading && !data && <CardSkeleton lines={4} />}

      {isError && !data && <QueryError onRetry={() => refetch()} />}

      {/* Live matches */}
      {matches.length > 0 ? (
        <>
          <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink-200">
            {matches.length} match{matches.length > 1 ? 'es' : ''} in progress
          </h3>
          {matches.map(m => {
            const key = `${m.home}v${m.away}`
            const history = wpaHistory[key] ?? []
            const isHT = m.status === 'PAUSED'
            const isPens = m.status === 'PENALTY_SHOOTOUT'
            const minLabel = isHT ? 'HT' : isPens ? 'Pens' : m.minute_estimated ? `~${m.minute}'` : `${m.minute}'`

            // Upset alert: underdog's win probability has jumped ≥22pp vs prematch
            let upsetAlert: string | null = null
            if (m.live_probs && m.prematch) {
              const homeShift = m.live_probs.p_home - m.prematch.p_home
              const awayShift = m.live_probs.p_away - m.prematch.p_away
              if (homeShift >= 0.22 && m.prematch.p_home < m.prematch.p_away)
                upsetAlert = `${m.home} overturning (+${(homeShift * 100).toFixed(0)}pp vs prematch)`
              else if (awayShift >= 0.22 && m.prematch.p_away < m.prematch.p_home)
                upsetAlert = `${m.away} overturning (+${(awayShift * 100).toFixed(0)}pp vs prematch)`
            }

            return (
              <GlassCard key={key} className="border-beam relative p-5 sm:p-6 space-y-5">
                {/* Score row */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 min-w-0">
                    <FlagImage code={flags[m.home]} size={32} alt={m.home} />
                    <span className="font-display text-lg sm:text-2xl uppercase tracking-wide text-ink-50 truncate">
                      {m.home}
                    </span>
                  </div>
                  <div className="text-center shrink-0 px-2">
                    <div className="font-display text-4xl sm:text-5xl text-ink-50 tracking-wider tabular-nums">
                      {m.score_home}–{m.score_away}
                    </div>
                    <div className="text-xs font-bold mt-1 text-gold uppercase tracking-[0.2em]">{minLabel}</div>
                  </div>
                  <div className="flex items-center gap-3 min-w-0 justify-end">
                    <span className="font-display text-lg sm:text-2xl uppercase tracking-wide text-ink-50 truncate text-right">
                      {m.away}
                    </span>
                    <FlagImage code={flags[m.away]} size={32} alt={m.away} />
                  </div>
                </div>

                {upsetAlert && (
                  <div className="flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 border border-gold/40 bg-gradient-to-r from-host-red/15 via-gold/10 to-host-red/15 shadow-[0_0_24px_rgba(212,175,55,0.15)]">
                    <Zap size={15} className="text-gold" />
                    <span className="font-display text-sm uppercase tracking-[0.1em] text-gold-soft">
                      Upset in progress — {upsetAlert}
                    </span>
                  </div>
                )}

                {/* Live probabilities */}
                {m.live_probs && (
                  m.is_ko ? (
                    <div className="space-y-1.5">
                      <div className="grid grid-cols-2 gap-3">
                        <ProbBadge label={`${m.home} wins`} value={m.live_probs.p_home} color="var(--color-host-blue-bright)" />
                        <ProbBadge label={`${m.away} wins`} value={m.live_probs.p_away} color="var(--color-host-red)" />
                      </div>
                      <p className="text-center text-[10px] text-ink-500 uppercase tracking-[0.14em]">
                        Knockout — includes ET &amp; penalties · no draw possible
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <ProbBadge label={`${m.home} win`} value={m.live_probs.p_home} color="var(--color-host-blue-bright)" />
                      <ProbBadge label="Draw" value={m.live_probs.p_draw} color="var(--color-ink-400)" />
                      <ProbBadge label={`${m.away} win`} value={m.live_probs.p_away} color="var(--color-host-red)" />
                    </div>
                  )
                )}

                {/* Live match stats from API-Football */}
                {m.match_stats && (
                  <MatchStatsPanel stats={m.match_stats} home={m.home} away={m.away} />
                )}

                {/* WPA timeline — shows from 1st poll onward */}
                {history.length >= 1 && (
                  <WinProbTimeline points={history} home={m.home} away={m.away} />
                )}

                {/* Pre-match prediction */}
                {m.prematch && (
                  <Collapsible title="Pre-match prediction" icon={Info} accent="neutral">
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
                      <span className="text-host-blue-bright font-semibold">{m.home} {(m.prematch.p_home * 100).toFixed(0)}%</span>
                      {!m.is_ko && (
                        <span className="text-ink-400">Draw {(m.prematch.p_draw * 100).toFixed(0)}%</span>
                      )}
                      <span className="text-host-red font-semibold">{m.away} {(m.prematch.p_away * 100).toFixed(0)}%</span>
                      {m.prematch.lambda_home != null && (
                        <span className="text-ink-500">
                          xG {m.prematch.lambda_home.toFixed(2)} – {m.prematch.lambda_away?.toFixed(2)}
                        </span>
                      )}
                      {m.is_ko && (
                        <span className="text-ink-500 w-full text-[11px]">Odds include ET &amp; penalties</span>
                      )}
                    </div>
                  </Collapsible>
                )}
              </GlassCard>
            )
          })}
        </>
      ) : (
        <>
          {/* Today's upcoming matches */}
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-display text-sm uppercase tracking-[0.14em] text-ink-200">
                Today's upcoming matches
              </h3>
              {upcoming.map((m, i) => (
                <GlassCard key={i} hover accent="blue" className="p-4">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagImage code={flags[m.home]} size={24} alt={m.home} />
                      <span className="font-semibold text-ink-50">{m.home}</span>
                      <span className="text-ink-500 text-xs uppercase">vs</span>
                      <FlagImage code={flags[m.away]} size={24} alt={m.away} />
                      <span className="font-semibold text-ink-50">{m.away}</span>
                    </div>
                    <div className="text-ink-400 text-sm">
                      {formatLocalTime(m.utc_date)}
                    </div>
                  </div>
                  {m.prediction && (
                    <div className="flex gap-4 mt-2 text-sm">
                      <span className="font-semibold text-host-blue-bright">{(m.prediction.p_home * 100).toFixed(0)}%</span>
                      <span className="text-ink-400">{(m.prediction.p_draw * 100).toFixed(0)}%</span>
                      <span className="font-semibold text-host-red">{(m.prediction.p_away * 100).toFixed(0)}%</span>
                    </div>
                  )}
                </GlassCard>
              ))}
            </div>
          )}

          {!isLoading && upcoming.length === 0 && (
            <EmptyState
              icon={CalendarClock}
              title="Nothing live right now"
              hint="No matches currently in progress or scheduled today."
            />
          )}
        </>
      )}
    </div>
  )
}
