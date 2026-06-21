import Plot from 'react-plotly.js'

interface Props {
  matrix: number[][]
  home: string
  away: string
}

export function ScorelineHeatmap({ matrix, home, away }: Props) {
  const n = matrix.length
  const labels = Array.from({ length: n }, (_, i) => String(i))
  const text = matrix.map(row => row.map(v => `${(v * 100).toFixed(1)}%`))

  return (
    <Plot
      data={[{
        type: 'heatmap',
        z: matrix,
        x: labels,
        y: labels,
        text,
        texttemplate: '%{text}',
        colorscale: 'Blues',
        showscale: false,
        hovertemplate: `${home} %{y} – %{x} ${away}: %{text}<extra></extra>`,
      } as any]}
      layout={{
        height: 380,
        paper_bgcolor: 'transparent',
        plot_bgcolor: '#1e293b',
        font: { color: '#e2e8f0', size: 11 },
        margin: { l: 40, r: 10, t: 10, b: 50 },
        xaxis: { title: `${away} goals`, color: '#94a3b8', gridcolor: '#334155' },
        yaxis: { title: `${home} goals`, color: '#94a3b8', gridcolor: '#334155' },
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
