import Plot from 'react-plotly.js'
import type { SummaryRow } from '../../api/types'

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
        marker: { color: '#16a34a' },
        text: top.map(r => `${(r['P(Champion)'] * 100).toFixed(1)}%`),
        textposition: 'auto',
      } as any]}
      layout={{
        title: title ? { text: title, font: { color: '#e2e8f0', size: 14 } } : undefined,
        height: Math.max(300, topN * 30 + 60),
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#e2e8f0', size: 12 },
        margin: { l: 130, r: 20, t: title ? 40 : 10, b: 30 },
        xaxis: { tickformat: '.0%', color: '#94a3b8', gridcolor: '#1e293b' },
        yaxis: { color: '#e2e8f0' },
        showlegend: false,
      }}
      config={{ displayModeBar: false, responsive: true }}
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
  const labels = ['R32', 'R16', 'QF', 'SF', 'Final', '🏆 Champion']
  const colors = ['#475569', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#16a34a']
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
      layout={{
        height: 260,
        paper_bgcolor: 'transparent',
        plot_bgcolor: 'transparent',
        font: { color: '#e2e8f0', size: 12 },
        margin: { l: 10, r: 10, t: 10, b: 30 },
        yaxis: { tickformat: '.0%', range: [0, 1], color: '#94a3b8', gridcolor: '#1e293b' },
        xaxis: { color: '#e2e8f0' },
        showlegend: false,
        barmode: 'group',
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%' }}
    />
  )
}
