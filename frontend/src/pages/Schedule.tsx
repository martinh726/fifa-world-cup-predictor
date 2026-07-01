import { useState, useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { fetchSchedule, fetchTeams } from '../api'
import { FlagImage } from '../components/shared/FlagImage'
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

function stageLabel(stage?: string) {
  if (!stage) return ''
  return STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ')
}

function stagePill(stage?: string) {
  if (!stage) return null
  const label = stageLabel(stage)
  let bg = '#1a3060', color = '#90aacb'
  if (stage === 'FINAL') { bg = 'rgba(201,162,39,0.15)'; color = '#c9a227' }
  else if (stage === 'SEMI_FINALS') { bg = 'rgba(196,18,48,0.15)'; color = '#c41230' }
  else if (stage === 'QUARTER_FINALS') { bg = 'rgba(0,48,135,0.3)'; color = '#5b8fd4' }
  else if (stage === 'ROUND_OF_16' || stage === 'LAST_16') { bg = 'rgba(0,102,51,0.2)'; color = '#4ade80' }
  else if (stage === 'ROUND_OF_32' || stage === 'LAST_32') { bg = 'rgba(46,74,120,0.3)'; color = '#5878a8' }
  return (
    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
      style={{ backgroundColor: bg, color }}>
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

  if (diff <= 0) return <span className="text-xs text-green-400 font-semibold">Kickoff!</span>

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
    <span className="text-xs font-mono tabular-nums" style={{ color: '#c9a227' }}>
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
        { label: home.slice(0, 3).toUpperCase(), prob: p_home, color: '#003087' },
        { label: 'DRW', prob: p_draw, color: '#475569' },
        { label: away.slice(0, 3).toUpperCase(), prob: p_away, color: '#c41230' },
      ].map(({ label, prob, color }) => (
        <div key={label} className="flex items-center gap-1.5">
          <span className="text-[10px] text-slate-400 w-7 text-right font-mono">{label}</span>
          <div className="flex-1 h-1.5 rounded-full overflow-hidden bg-slate-700/70">
            <div className="h-full rounded-full" style={{ width: `${prob * 100}%`, backgroundColor: color }} />
          </div>
          <span className="text-[10px] text-slate-300 font-mono w-8 text-right">{(prob * 100).toFixed(0)}%</span>
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
      <div className="flex items-center justify-center h-48 text-slate-400 text-sm">
        Loading fixtures…
      </div>
    )
  }

  if (!grouped.length) {
    return (
      <div className="bg-slate-800 rounded-xl p-8 text-center">
        <div className="text-4xl mb-3">📅</div>
        <div className="text-slate-300 font-semibold mb-1">No upcoming fixtures</div>
        <div className="text-slate-500 text-sm">
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
          <h2 className="text-lg font-bold text-white">Fixtures</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {scheduleData?.matches.length ?? 0} upcoming matches
            {age !== null ? ` · updated ${age}s ago` : ''}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap text-[10px]">
          {[
            ['Round of 32', '#2e4a78'],
            ['Round of 16', '#006633'],
            ['Quarter-Final', '#003087'],
            ['Semi-Final', '#c41230'],
            ['Final', '#c9a227'],
          ].map(([l, c]) => (
            <span key={l} className="px-2 py-0.5 rounded-full font-semibold uppercase tracking-wide"
              style={{ backgroundColor: `${c}30`, color: c }}>
              {l}
            </span>
          ))}
        </div>
      </div>

      {/* Date groups */}
      {grouped.map(([dateLabel, matches]) => (
        <div key={dateLabel}>
          <div className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-2 px-1"
            style={{ borderLeft: '3px solid #c9a227', paddingLeft: 8 }}>
            {dateLabel}
          </div>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {matches.map(m => {
              const hrs = m.utc_date ? hoursUntil(m.utc_date) : Infinity
              const showCountdown = hrs > 0 && hrs < 72
              return (
                <div key={m.id}
                  className="rounded-xl p-4 flex flex-col gap-2"
                  style={{
                    backgroundColor: '#09142a',
                    border: '1px solid rgba(201,162,39,0.12)',
                  }}
                >
                  {/* Stage + time row */}
                  <div className="flex items-center justify-between gap-2">
                    <div>{stagePill(m.stage)}</div>
                    <span className="text-xs text-slate-400">{formatLocalKickoff(m.utc_date)}</span>
                  </div>

                  {/* Teams */}
                  <div className="flex items-center justify-between gap-3 py-1">
                    <div className="flex items-center gap-2 min-w-0">
                      <FlagImage code={flags[m.home]} size={20} />
                      <span className="text-sm font-semibold text-slate-100 truncate">{m.home}</span>
                    </div>
                    <span className="text-xs text-slate-500 font-bold shrink-0">vs</span>
                    <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
                      <FlagImage code={flags[m.away]} size={20} />
                      <span className="text-sm font-semibold text-slate-100 truncate text-right">{m.away}</span>
                    </div>
                  </div>

                  {/* Countdown */}
                  {showCountdown && (
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
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
