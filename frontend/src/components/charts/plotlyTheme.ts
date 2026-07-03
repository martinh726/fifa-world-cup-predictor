import type { Layout } from 'plotly.js'

// Literal resolved hex/rgba values — Plotly's SVG renderer doesn't reliably
// resolve CSS custom properties, so this file is the single source of truth.
// Dark cinematic theme: host-nation trio + gold on Outer Space ink.
export const CHART_COLORS = {
  home: '#3D52C4',        // host blue (bright variant — #2A398D is illegible on dark)
  draw: '#8b9094',
  away: '#E61D25',        // Torch Red
  success: '#3CAC3B',     // Average Green
  warning: '#E9A13B',
  danger: '#E61D25',
  gold: '#D4AF37',
  categorical: ['#3D52C4', '#E61D25', '#3CAC3B', '#D4AF37', '#f4f5f6'],
  text: '#f4f5f6',
  textMuted: '#8b9094',
  grid: 'rgba(255,255,255,0.07)',
  line: 'rgba(255,255,255,0.14)',
  cardBg: '#1b1e21',
}

export function baseLayout(overrides: Partial<Layout> = {}): Partial<Layout> {
  return {
    paper_bgcolor: 'transparent',
    plot_bgcolor: 'transparent',
    font: { color: CHART_COLORS.text, size: 12, family: "'Archivo', system-ui, sans-serif" },
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
