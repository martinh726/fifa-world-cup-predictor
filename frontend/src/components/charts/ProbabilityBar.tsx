import Plot from 'react-plotly.js'

interface Props {
  home: string
  away: string
  pHome: number
  pDraw: number
  pAway: number
}

export function ProbabilityBar({ home, away, pHome, pDraw, pAway }: Props) {
  return (
    <Plot
      data={[{
        type: 'bar',
        x: [pHome, pDraw, pAway],
        y: [`${home} win`, 'Draw', `${away} win`],
        orientation: 'h',
        marker: { color: ['#2563eb', '#6b7280', '#dc2626'] },
        text: [`${(pHome * 100).toFixed(1)}%`, `${(pDraw * 100).toFixed(1)}%`, `${(pAway * 100).toFixed(1)}%`],
        textposition: 'auto',
      } as any]}
      layout={{
        height: 200,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#e2e8f0', size: 13 },
        margin: { l: 90, r: 20, t: 10, b: 30 },
        xaxis: { tickformat: '.0%', range: [0, 1], color: '#94a3b8', gridcolor: '#1e293b' },
        yaxis: { color: '#e2e8f0' },
        showlegend: false,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
