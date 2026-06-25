import Plot from 'react-plotly.js'

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
            line: { color: '#3b82f6', width: 2.5 },
            marker: { ...traceBase.marker, color: '#3b82f6' },
          },
          {
            ...traceBase,
            x: minutes, y: points.map(p => p.p_draw),
            name: 'Draw',
            line: { color: '#94a3b8', width: 2, dash: 'dot' },
            marker: { ...traceBase.marker, color: '#94a3b8' },
          },
          {
            ...traceBase,
            x: minutes, y: points.map(p => p.p_away),
            name: away,
            line: { color: '#f87171', width: 2.5 },
            marker: { ...traceBase.marker, color: '#f87171' },
          },
        ] as any[]}
        layout={{
          height: 240,
          paper_bgcolor: 'transparent',
          plot_bgcolor: '#0f172a',
          font: { color: '#cbd5e1', size: 11 },
          margin: { l: 44, r: 12, t: 8, b: 36 },
          xaxis: {
            title: { text: 'Minute', font: { size: 10, color: '#64748b' } },
            range: [0, 95],
            color: '#475569',
            gridcolor: '#1e293b',
            linecolor: '#334155',
            tickcolor: '#475569',
            dtick: 15,
            tickfont: { size: 10 },
          },
          yaxis: {
            tickformat: '.0%',
            range: [0, 1],
            color: '#475569',
            gridcolor: '#1e293b',
            linecolor: '#334155',
            tickcolor: '#475569',
            tickfont: { size: 10 },
            dtick: 0.25,
          },
          legend: {
            orientation: 'h',
            x: 0.5, xanchor: 'center',
            y: 1.08, yanchor: 'bottom',
            font: { size: 11, color: '#cbd5e1' },
            bgcolor: 'transparent',
          },
          hovermode: 'x unified',
          hoverlabel: {
            bgcolor: '#1e293b',
            bordercolor: '#475569',
            font: { color: '#e2e8f0', size: 12, family: 'monospace' },
          },
        }}
        config={{ displayModeBar: false, responsive: true }}
        style={{ width: '100%' }}
      />
    </div>
  )
}
