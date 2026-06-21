interface Props {
  code: string | null | undefined
  size?: number
  alt?: string
}

export function FlagImage({ code, size = 24, alt = '' }: Props) {
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/w${size * 2}/${code}.png`}
      alt={alt}
      width={size}
      style={{ borderRadius: 2, display: 'inline-block', verticalAlign: 'middle' }}
    />
  )
}

export function flagUrl(code: string | null | undefined, size = 40): string {
  if (!code) return ''
  return `https://flagcdn.com/w${size}/${code}.png`
}
