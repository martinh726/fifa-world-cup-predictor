import Plot from 'react-plotly.js'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from './plotlyTheme'

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
        marker: { color: [CHART_COLORS.home, CHART_COLORS.draw, CHART_COLORS.away] },
        text: [`${(pHome * 100).toFixed(1)}%`, `${(pDraw * 100).toFixed(1)}%`, `${(pAway * 100).toFixed(1)}%`],
        textposition: 'auto',
      } as any]}
      layout={baseLayout({
        height: 200,
        font: { color: CHART_COLORS.text, size: 13 },
        margin: { l: 90, r: 20, t: 10, b: 30 },
        xaxis: { tickformat: '.0%', range: [0, 1], color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid },
        yaxis: { color: CHART_COLORS.text },
        showlegend: false,
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
