interface Props {
  code: string | null | undefined
  size?: number
  alt?: string
}

export function FlagImage({ code, size = 24, alt = '' }: Props) {
  if (!code) return null
  return (
    <img
      src={`https://flagcdn.com/${code}.svg`}
      alt={alt}
      width={size}
      height={Math.round(size * 0.67)}
      style={{ borderRadius: 2, display: 'inline-block', verticalAlign: 'middle' }}
      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }}
    />
  )
}

export function flagUrl(code: string | null | undefined): string {
  if (!code) return ''
  return `https://flagcdn.com/${code}.svg`
}
