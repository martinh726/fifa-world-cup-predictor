import Plot from 'react-plotly.js'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from './plotlyTheme'

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
        colorscale: [[0, CHART_COLORS.cardBg], [1, CHART_COLORS.home]],
        showscale: false,
        hovertemplate: `${home} %{y} – %{x} ${away}: %{text}<extra></extra>`,
      } as any]}
      layout={baseLayout({
        height: 380,
        font: { color: CHART_COLORS.text, size: 11 },
        margin: { l: 40, r: 10, t: 10, b: 50 },
        xaxis: { title: { text: `${away} goals` }, color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.line },
        yaxis: { title: { text: `${home} goals` }, color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.line },
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
