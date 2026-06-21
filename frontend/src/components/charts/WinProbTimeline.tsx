import Plot from 'react-plotly.js'

interface WpaPoint { minute: number; p_home: number; p_draw: number; p_away: number }

interface Props {
  points: WpaPoint[]
  home: string
  away: string
}

export function WinProbTimeline({ points, home, away }: Props) {
  if (points.length < 2) {
    return <div className="text-slate-500 text-sm py-4">Building timeline…</div>
  }

  const minutes = points.map(p => p.minute)
  return (
    <Plot
      data={[
        {
          x: minutes, y: points.map(p => p.p_home),
          name: home, type: 'scatter', mode: 'lines',
          line: { color: '#2563eb', width: 2 },
        },
        {
          x: minutes, y: points.map(p => p.p_draw),
          name: 'Draw', type: 'scatter', mode: 'lines',
          line: { color: '#6b7280', width: 2, dash: 'dot' },
        },
        {
          x: minutes, y: points.map(p => p.p_away),
          name: away, type: 'scatter', mode: 'lines',
          line: { color: '#dc2626', width: 2 },
        },
      ] as any[]}
      layout={{
        height: 260,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#e2e8f0', size: 11 },
        margin: { l: 40, r: 10, t: 10, b: 40 },
        xaxis: { title: "Minute", range: [0, 90], color: '#94a3b8', gridcolor: '#1e293b' },
        yaxis: { tickformat: '.0%', range: [0, 1], color: '#94a3b8', gridcolor: '#1e293b' },
        legend: { orientation: 'h', y: -0.2, font: { size: 11 } },
        hovermode: 'x unified',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
