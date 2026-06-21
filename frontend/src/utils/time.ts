/**
 * Format a UTC date string into the user's local timezone.
 * The browser's Intl engine automatically picks up the user's locale and offset.
 */
export function formatLocalKickoff(utcDate: string | null | undefined): string {
  if (!utcDate) return ''
  const d = new Date(utcDate)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}

/** Just the time portion (e.g. "7:00 PM EDT") — for compact inline display. */
export function formatLocalTime(utcDate: string | null | undefined): string {
  if (!utcDate) return ''
  const d = new Date(utcDate)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZoneName: 'short',
  })
}
