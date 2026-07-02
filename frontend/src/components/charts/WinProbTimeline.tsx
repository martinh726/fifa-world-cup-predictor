import Plot from 'react-plotly.js'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from './plotlyTheme'

interface WpaPoint { minute: number; p_home: number; p_draw: number; p_away: number }

interface Props {
  points: WpaPoint[]
  home: string
  away: string
}

export function WinProbTimeline({ points, home, away }: Props) {
  if (points.length === 0) {
    return <div className="text-slate-500 text-sm py-4">Building timeline…</div>
  }

  const minutes = points.map(p => p.minute)
  const uniqueMinutes = new Set(minutes).size
  const hasLine = uniqueMinutes > 1
  const mode = hasLine ? 'lines+markers' : 'markers'

  const traceBase = {
    type: 'scatter' as const,
    mode,
    marker: { size: hasLine ? 4 : 10 },
    hovertemplate: '%{y:.0%}<extra></extra>',
  }

  return (
    <div>
      {!hasLine && (
        <div className="text-slate-500 text-xs mb-1">
          Snapshot at {minutes[0]}′ — chart builds as the match progresses
        </div>
      )}
      <Plot
        data={[
          {
            ...traceBase,
            x: minutes, y: points.map(p => p.p_home),
            name: home,
            line: { color: CHART_COLORS.home, width: 2.5 },
            marker: { ...traceBase.marker, color: CHART_COLORS.home },
          },
          {
            ...traceBase,
            x: minutes, y: points.map(p => p.p_draw),
            name: 'Draw',
            line: { color: CHART_COLORS.draw, width: 2, dash: 'dot' },
            marker: { ...traceBase.marker, color: CHART_COLORS.draw },
          },
          {
            ...traceBase,
            x: minutes, y: points.map(p => p.p_away),
            name: away,
            line: { color: CHART_COLORS.away, width: 2.5 },
            marker: { ...traceBase.marker, color: CHART_COLORS.away },
          },
        ] as any[]}
        layout={baseLayout({
          height: 240,
          font: { color: CHART_COLORS.textMuted, size: 11 },
          margin: { l: 44, r: 12, t: 8, b: 36 },
          xaxis: {
            title: { text: 'Minute', font: { size: 10, color: CHART_COLORS.textMuted } },
            range: [0, 95],
            color: CHART_COLORS.textMuted,
            gridcolor: CHART_COLORS.grid,
            linecolor: CHART_COLORS.line,
            tickcolor: CHART_COLORS.textMuted,
            dtick: 15,
            tickfont: { size: 10 },
          },
          yaxis: {
            tickformat: '.0%',
            range: [0, 1],
            color: CHART_COLORS.textMuted,
            gridcolor: CHART_COLORS.grid,
            linecolor: CHART_COLORS.line,
            tickcolor: CHART_COLORS.textMuted,
            tickfont: { size: 10 },
            dtick: 0.25,
          },
          legend: {
            orientation: 'h',
            x: 0.5, xanchor: 'center',
            y: 1.08, yanchor: 'bottom',
            font: { size: 11, color: CHART_COLORS.text },
            bgcolor: 'transparent',
          },
          hovermode: 'x unified',
          hoverlabel: {
            bgcolor: CHART_COLORS.cardBg,
            bordercolor: CHART_COLORS.line,
            font: { color: CHART_COLORS.text, size: 12, family: 'monospace' },
          },
        })}
        config={CHART_CONFIG}
        style={{ width: '100%' }}
      />
    </div>
  )
}
