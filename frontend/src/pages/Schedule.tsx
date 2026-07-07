import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarDays, Timer, CalendarX } from 'lucide-react'
import { fetchSchedule, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
import { PageHeader } from '../components/ui/PageHeader'
import { GlassCard } from '../components/ui/GlassCard'
import { CardSkeleton } from '../components/ui/Skeleton'
import { EmptyState } from '../components/ui/EmptyState'
import { QueryError } from '../components/ui/QueryError'
import type { Accent } from '../components/ui/accents'
import { formatLocalKickoff } from '../utils/time'

const STAGE_LABELS: Record<string, string> = {
  GROUP_STAGE: 'Group Stage',
  ROUND_OF_32: 'Round of 32',
  LAST_32: 'Round of 32',
  ROUND_OF_16: 'Round of 16',
  LAST_16: 'Round of 16',
  QUARTER_FINALS: 'Quarter-Final',
  SEMI_FINALS: 'Semi-Final',
  THIRD_PLACE: '3rd Place Playoff',
  FINAL: 'Final',
}

// Stage → host-palette dot + card glow accent
const STAGE_COLORS: Record<string, { dot: string; accent: Accent }> = {
  ROUND_OF_32: { dot: 'var(--color-host-blue-bright)', accent: 'blue' },
  LAST_32: { dot: 'var(--color-host-blue-bright)', accent: 'blue' },
  ROUND_OF_16: { dot: 'var(--color-host-green)', accent: 'green' },
  LAST_16: { dot: 'var(--color-host-green)', accent: 'green' },
  QUARTER_FINALS: { dot: 'var(--color-gold)', accent: 'gold' },
  SEMI_FINALS: { dot: 'var(--color-host-red)', accent: 'red' },
  FINAL: { dot: 'var(--color-gold)', accent: 'gold' },
}

function stageLabel(stage?: string) {
  if (!stage) return ''
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}

function stagePill(stage?: string) {
  if (!stage) return null
  const label = stageLabel(stage)
  const dot = STAGE_COLORS[stage]?.dot ?? 'var(--color-ink-500)'
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-white/[0.06] border border-white/[0.08] text-ink-300">
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: dot }} />
      {label}
    </span>
  )
}

function Countdown({ utcDate }: { utcDate: string }) {
  const [diff, setDiff] = useState(() => new Date(utcDate).getTime() - Date.now())

  useEffect(() => {
    const id = setInterval(() => setDiff(new Date(utcDate).getTime() - Date.now()), 1000)
    return () => clearInterval(id)
  }, [utcDate])

  if (diff <= 0) return <span className="text-xs font-semibold text-host-green">Kickoff!</span>

  const s = Math.floor(diff / 1000)
  const d = Math.floor(s / 86400)
  const h = Math.floor((s % 86400) / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60

  const parts = []
  if (d > 0) parts.push(`${d}d`)
  if (h > 0 || d > 0) parts.push(`${h}h`)
  parts.push(`${m}m`)
  if (d === 0) parts.push(`${sec}s`)

  return (
    <span className="text-xs font-mono tabular-nums font-semibold text-gold">
      {parts.join(' ')}
    </span>
  )
}

function ProbBars({ p_home, p_draw, p_away, home, away }: {
  p_home: number; p_draw: number; p_away: number; home: string; away: string
}) {
  return (
    <div className="space-y-1 mt-2">
      {[
        { label: home.slice(0, 3).toUpperCase(), prob: p_home, color: 'var(--color-host-blue-bright)' },
        { label: 'DRW', prob: p_draw, color: 'var(--color-ink-500)' },
        { label: away.slice(0, 3).toUpperCase(), prob: p_away, color: 'var(--color-host-red)' },
      ].map(({ label, prob, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-ink-500 w-7 text-right font-mono">{label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-white/[0.07]">
            <div className="h-full rounded-full" style={{ width: `${prob * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] text-ink-300 font-mono w-8 text-right">{(prob * 100).toFixed(0)}%</span>
        </div>
      ))}
    </div>
  )
}

function localDateKey(utcDate: string): string {
  const d = new Date(utcDate)
  return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })
}

function hoursUntil(utcDate: string): number {
  return (new Date(utcDate).getTime() - Date.now()) / 3_600_000
}

export function Schedule() {
  const { data: scheduleData, isLoading, isError, refetch, dataUpdatedAt } = useQuery({
    queryKey: ['schedule', 60],
    queryFn: () => fetchSchedule(60),
    staleTime: 600_000,
    refetchInterval: 600_000,
  })
  const { data: teamsData } = useQuery({ queryKey: ['teams'], queryFn: fetchTeams })
  const flags = teamsData?.flags ?? {}

  const grouped = useMemo(() => {
    if (!scheduleData?.matches) return []
    const byDate: Record<string, typeof scheduleData.matches> = {}
    for (const m of scheduleData.matches) {
      if (!m.utc_date) continue
      const key = localDateKey(m.utc_date)
      if (!byDate[key]) byDate[key] = []
      byDate[key].push(m)
    }
    return Object.entries(byDate)
  }, [scheduleData])

  const age = dataUpdatedAt ? Math.floor((Date.now() - dataUpdatedAt) / 1000) : null

  if (isLoading) {
    return (
      <div className="stagger space-y-5">
        <PageHeader title="Fixtures" icon={CalendarDays} subtitle="Loading upcoming matches…" />
        <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} lines={2} />)}
        </div>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="stagger space-y-5">
        <PageHeader title="Fixtures" icon={CalendarDays} />
        <QueryError onRetry={() => refetch()} />
      </div>
    )
  }

  if (!grouped.length) {
    return (
      <div className="stagger space-y-5">
        <PageHeader title="Fixtures" icon={CalendarDays} />
        <EmptyState
          icon={CalendarX}
          title="No upcoming fixtures"
          hint={
            scheduleData && 'error' in scheduleData && (scheduleData as any).error
              ? (scheduleData as any).error
              : 'All scheduled matches have been played or no API key is configured.'
          }
        />
      </div>
    )
  }

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Fixtures"
        icon={CalendarDays}
        subtitle={`${scheduleData?.matches.length ?? 0} upcoming matches${age !== null ? ` · updated ${age}s ago` : ''}`}
        actions={
          <div className="flex gap-2 flex-wrap text-[10px] max-w-md justify-end">
            {[
              ['Round of 32', 'var(--color-host-blue-bright)'],
              ['Round of 16', 'var(--color-host-green)'],
              ['Quarter-Final', 'var(--color-gold)'],
              ['Semi-Final', 'var(--color-host-red)'],
              ['Final', 'var(--color-gold)'],
            ].map(([l, c]) => (
              <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-white/[0.06] border border-white/[0.08] text-ink-300">
                <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
                {l}
              </span>
            ))}
          </div>
        }
      />

      {/* Date groups */}
      {grouped.map(([dateLabel, matches]) => (
        <div key={dateLabel}>
          <div className="flex items-center gap-2.5 mb-3">
            <span className="h-4 w-[3px] rounded-full bg-gold" aria-hidden="true" />
            <span className="font-display text-xs uppercase tracking-[0.25em] text-ink-300">
              {dateLabel}
            </span>
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {matches.map(m => {
              const hrs = m.utc_date ? hoursUntil(m.utc_date) : Infinity
              const showCountdown = hrs > 0 && hrs < 72
              const accent = STAGE_COLORS[m.stage ?? '']?.accent ?? 'blue'
              const isFinal = m.stage === 'FINAL'
              return (
                <GlassCard
                  key={m.id}
                  hover
                  accent={accent}
                  className={`p-4 flex flex-col gap-2 ${isFinal ? 'border-beam' : ''}`}
                >
                  {/* Stage + time row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>{stagePill(m.stage)}</div>
                    <span className="text-xs text-ink-400">{formatLocalKickoff(m.utc_date)}</span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagImage code={flags[m.home]} size={20} />
                      <span className="text-sm font-semibold text-ink-50 truncate">{m.home}</span>
                    </div>
                    <span className="font-display text-xs text-gold shrink-0">VS</span>
                    <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
                      <FlagImage code={flags[m.away]} size={20} />
                      <span className="text-sm font-semibold text-ink-50 truncate text-right">{m.away}</span>
                    </div>
                  </div>

                  {/* Countdown */}
                  {showCountdown && (
                    <div className="flex items-center gap-1.5 text-xs text-ink-400">
                      <Timer size={12} className="text-gold" />
                      <Countdown utcDate={m.utc_date} />
                    </div>
                  )}

                  {/* Prediction bars */}
                  {m.prediction && (
                    <ProbBars
                      p_home={m.prediction.p_home}
                      p_draw={m.prediction.p_draw}
                      p_away={m.prediction.p_away}
                      home={m.home}
                      away={m.away}
                    />
                  )}
                </GlassCard>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
