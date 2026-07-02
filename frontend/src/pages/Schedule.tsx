import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSchedule, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
import { BrandArcPattern } from '../components/shared/BrandArcPattern'
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

const STAGE_DOTS: Record<string, string> = {
  ROUND_OF_32: 'var(--color-wc-blue)',
  LAST_32: 'var(--color-wc-blue)',
  ROUND_OF_16: 'var(--color-wc-green)',
  LAST_16: 'var(--color-wc-green)',
  QUARTER_FINALS: 'var(--color-wc-orange)',
  SEMI_FINALS: 'var(--color-wc-red)',
  FINAL: 'var(--color-wc-gold)',
}

function stageLabel(stage?: string) {
  if (!stage) return ''
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}

function stagePill(stage?: string) {
  if (!stage) return null
  const label = stageLabel(stage)
  const dot = STAGE_DOTS[stage] ?? 'var(--color-slate-400)'
  return (
    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
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

  if (diff <= 0) return <span className="text-xs font-semibold" style={{ color: 'var(--color-success)' }}>Kickoff!</span>

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
    <span className="text-xs font-mono tabular-nums font-semibold" style={{ color: 'var(--color-warning)' }}>
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
        { label: home.slice(0, 3).toUpperCase(), prob: p_home, color: 'var(--color-wc-blue)' },
        { label: 'DRW', prob: p_draw, color: 'var(--color-slate-400)' },
        { label: away.slice(0, 3).toUpperCase(), prob: p_away, color: 'var(--color-wc-red)' },
      ].map(({ label, prob, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-500 w-7 text-right font-mono">{label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-200">
            <div className="h-full rounded-full" style={{ width: `${prob * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] text-slate-600 font-mono w-8 text-right">{(prob * 100).toFixed(0)}%</span>
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
  const { data: scheduleData, isLoading, dataUpdatedAt } = useQuery({
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
      <div className="flex items-center justify-center h-48 text-slate-500 text-sm">
        Loading fixtures…
      </div>
    )
  }

  if (!grouped.length) {
    return (
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-8 text-center shadow-sm">
        <BrandArcPattern variant="full" opacity={0.1} className="absolute inset-0 w-full h-full" />
        <div className="relative text-4xl mb-3">📅</div>
        <div className="relative text-slate-700 font-semibold mb-1">No upcoming fixtures</div>
        <div className="relative text-slate-500 text-sm">
          {scheduleData && 'error' in scheduleData && (scheduleData as any).error
            ? (scheduleData as any).error
            : 'All scheduled matches have been played or no API key is configured.'}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Fixtures</h2>
          <p className="text-xs text-slate-500 mt-0.5">
            {scheduleData?.matches.length ?? 0} upcoming matches
            {age !== null ? ` · updated ${age}s ago` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap text-[10px]">
          {[
            ['Round of 32', 'var(--color-wc-blue)'],
            ['Round of 16', 'var(--color-wc-green)'],
            ['Quarter-Final', 'var(--color-wc-orange)'],
            ['Semi-Final', 'var(--color-wc-red)'],
            ['Final', 'var(--color-wc-gold)'],
          ].map(([l, c]) => (
            <span key={l} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide bg-slate-100 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: c }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Date groups */}
      {grouped.map(([dateLabel, matches]) => (
        <div key={dateLabel}>
          <div
            className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-2 px-1"
            style={{ borderLeft: '3px solid var(--color-wc-gold)', paddingLeft: 8 }}
          >
            {dateLabel}
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(m => {
              const hrs = m.utc_date ? hoursUntil(m.utc_date) : Infinity
              const showCountdown = hrs > 0 && hrs < 72
              return (
                <div
                  key={m.id}
                  className="rounded-xl p-4 flex flex-col gap-2 bg-white border border-slate-200 shadow-sm transition-shadow hover:shadow-md"
                >
                  {/* Stage + time row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>{stagePill(m.stage)}</div>
                    <span className="text-xs text-slate-500">{formatLocalKickoff(m.utc_date)}</span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagImage code={flags[m.home]} size={20} />
                      <span className="text-sm font-semibold text-slate-800 truncate">{m.home}</span>
                    </div>
                    <span className="text-xs text-slate-400 font-bold shrink-0">vs</span>
                    <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
                      <FlagImage code={flags[m.away]} size={20} />
                      <span className="text-sm font-semibold text-slate-800 truncate text-right">{m.away}</span>
                    </div>
                  </div>

                  {/* Countdown */}
                  {showCountdown && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-500">
                      <span>⏱</span>
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
                </div>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}
