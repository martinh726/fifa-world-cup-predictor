import { useId } from 'react'

// Concentric ring sweep echoing the FIFA World Cup 2026 "26" graphic: blue → lime → green → orange → red
const RING_COLORS = [
  'var(--color-wc-blue)',
  'var(--color-wc-lime)',
  'var(--color-wc-green)',
  'var(--color-wc-orange)',
  'var(--color-wc-red)',
]

interface BrandArcPatternProps {
  /** 'full' = wide radial sweep for headers/empty states, 'corner' = quarter-arc accent for card corners, 'divider' = repeating chevron strip */
  variant?: 'full' | 'corner' | 'divider'
  opacity?: number
  className?: string
}

export function BrandArcPattern({ variant = 'full', opacity = 1, className = '' }: BrandArcPatternProps) {
  const id = useId()

  if (variant === 'divider') {
    const patternId = `arc-divider-${id}`
    return (
      <svg
        className={className}
        style={{ opacity }}
        viewBox="0 0 200 20"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        <defs>
          <pattern id={patternId} width="40" height="20" patternUnits="userSpaceOnUse">
            {RING_COLORS.map((color, i) => (
              <path
                key={color}
                d={`M ${i * 8} 20 L ${i * 8 + 8} 0`}
                stroke={color}
                strokeWidth="4"
                strokeLinecap="round"
              />
            ))}
          </pattern>
        </defs>
        <rect width="200" height="20" fill={`url(#${patternId})`} />
      </svg>
    )
  }

  const center = variant === 'corner' ? 0 : 100
  const radii = [90, 74, 58, 42, 26]

  return (
    <svg
      className={className}
      style={{ opacity }}
      viewBox="0 0 100 100"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      {radii.map((r, i) => (
        <circle key={r} cx={center} cy={center} r={r} fill="none" stroke={RING_COLORS[i]} strokeWidth={7} />
      ))}
    </svg>
  )
}
