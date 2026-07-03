// Host-nation accent system — single source for hexes used in inline styles
// (shadows/glows need literal rgba values; Tailwind classes cover the rest).
export type Accent = 'red' | 'blue' | 'green' | 'gold' | 'neutral'

export const ACCENT: Record<Accent, { hex: string; glow: string; bg: string }> = {
  red:     { hex: '#E61D25', glow: 'rgba(230,29,37,0.35)',  bg: 'rgba(230,29,37,0.12)' },
  blue:    { hex: '#3D52C4', glow: 'rgba(61,82,196,0.40)',  bg: 'rgba(61,82,196,0.14)' },
  green:   { hex: '#3CAC3B', glow: 'rgba(60,172,59,0.35)',  bg: 'rgba(60,172,59,0.12)' },
  gold:    { hex: '#D4AF37', glow: 'rgba(212,175,55,0.35)', bg: 'rgba(212,175,55,0.12)' },
  neutral: { hex: '#8b9094', glow: 'rgba(139,144,148,0.25)', bg: 'rgba(139,144,148,0.10)' },
}
