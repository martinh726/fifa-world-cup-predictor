import type { Layout } from 'plotly.js'

// Literal resolved hex values — Plotly's SVG renderer doesn't reliably resolve
// CSS custom properties, so this file is the single source of truth instead.
export const CHART_COLORS = {
  home: '#0F3FA3',
  draw: '#8891a1',
  away: '#D3232B',
  success: '#1D8A4E',
  warning: '#B9720A',
  danger: '#C6242C',
  categorical: ['#0F3FA3', '#A8D93B', '#0E7A4A', '#F0872E', '#D3232B'],
  text: '#3b4252',
  textMuted: '#5b6474',
  grid: '#eceef2',
  line: '#dde1e8',
  cardBg: '#ffffff',
}

export function baseLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: CHART_COLORS.text, size: 12, family: 'system-ui, -apple-system, sans-serif' },
    xaxis: {
      color: CHART_COLORS.textMuted,
      gridcolor: CHART_COLORS.grid,
      linecolor: CHART_COLORS.line,
      zerolinecolor: CHART_COLORS.line,
    },
    yaxis: {
      color: CHART_COLORS.textMuted,
      gridcolor: CHART_COLORS.grid,
      linecolor: CHART_COLORS.line,
      zerolinecolor: CHART_COLORS.line,
    },
    margin: { l: 40, r: 20, t: 10, b: 30 },
    ...overrides,
  } as Partial<Layout>
}

export const CHART_CONFIG = { displayModeBar: false, responsive: true }
