import Plot from 'react-plotly.js'
import type { SummaryRow } from '../../api/types'
import { baseLayout, CHART_COLORS, CHART_CONFIG } from './plotlyTheme'

interface Props {
  summary: SummaryRow[]
  topN?: number
  title?: string
  flags?: Record<string, string>
}

export function ChampionshipOddsBar({ summary, topN = 16, title }: Props) {
  const top = summary.slice(0, topN).reverse()
  return (
    <Plot
      data={[{
        type: 'bar',
        x: top.map(r => r['P(Champion)']),
        y: top.map(r => r.team),
        orientation: 'h',
        marker: { color: CHART_COLORS.success },
        text: top.map(r => `${(r['P(Champion)'] * 100).toFixed(1)}%`),
        textposition: 'auto',
      } as any]}
      layout={baseLayout({
        title: title ? { text: title, font: { color: CHART_COLORS.text, size: 14 } } : undefined,
        height: Math.max(300, topN * 30 + 60),
        margin: { l: 130, r: 20, t: title ? 40 : 10, b: 30 },
        xaxis: { tickformat: '.0%', color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid },
        yaxis: { color: CHART_COLORS.text },
        showlegend: false,
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}

interface SingleTeamProps {
  odds: Record<string, number>
  team?: string
}

export function SingleTeamOddsBar({ odds }: SingleTeamProps) {
  const stages = ['P(R32)', 'P(R16)', 'P(QF)', 'P(SF)', 'P(Final)', 'P(Champion)']
  const labels = ['R32', 'R16', 'QF', 'SF', 'Final', 'Champion']
  const colors = [...CHART_COLORS.categorical, CHART_COLORS.gold]
  const values = stages.map(s => odds[s] ?? 0)

  return (
    <Plot
      data={stages.map((_, i) => ({
        type: 'bar',
        name: labels[i],
        x: [labels[i]],
        y: [values[i]],
        marker: { color: colors[i] },
        text: [`${(values[i] * 100).toFixed(1)}%`],
        textposition: 'auto',
      })) as any[]}
      layout={baseLayout({
        height: 260,
        margin: { l: 10, r: 10, t: 10, b: 30 },
        yaxis: { tickformat: '.0%', range: [0, 1], color: CHART_COLORS.textMuted, gridcolor: CHART_COLORS.grid },
        xaxis: { color: CHART_COLORS.text },
        showlegend: false,
        barmode: 'group',
      })}
      config={CHART_CONFIG}
      style={{ width: '100%' }}
    />
  )
}
