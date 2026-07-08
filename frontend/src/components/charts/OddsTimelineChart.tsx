import Plot from 'react-plotly.js'
import type { OddsSnapshot } from '../../api/types'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from './plotlyTheme'

interface Props {
  snapshots: OddsSnapshot[]
  topN?: number
}

export function OddsTimelineChart({ snapshots, topN = 8 }: Props) {
  if (snapshots.length < 2) return null

  const ordered = [...snapshots].sort((a, b) => a.date.localeCompare(b.date))
  const latest = ordered[ordered.length - 1]
  const teams = Object.entries(latest.odds)
    .sort(([, a], [, b]) => b - a)
    .slice(0, topN)
    .map(([team]) => team)

  const colors = CHART_COLORS.categorical
  const dates = ordered.map(s => s.date)

  return (
    <Plot
      data={teams.map((team, i) => ({
        type: 'scatter',
        mode: 'lines+markers',
        name: team,
        x: dates,
        y: ordered.map(s => s.odds[team] ?? null),
        connectgaps: true,
        line: { color: colors[i % colors.length], width: 2 },
        marker: { color: colors[i % colors.length], size: 5 },
      })) as any[]}
      layout={baseLayout({
        height: 360,
        margin: { l: 45, r: 15, t: 10, b: 40 },
        xaxis: { color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid, type: 'date' },
        yaxis: { tickformat: '.0%', color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid },
        showlegend: true,
        legend: { orientation: 'h', y: -0.2, font: { color: CHART_COLORS.textMuted, size: 10 } },
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
