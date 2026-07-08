import { AlertTriangle, RotateCcw } from 'lucide-react'
import { EmptyState } from './EmptyState'
import { Button } from './Button'

interface Props {
  title?: string
  hint?: string
  onRetry?: () => void
}

export function QueryError({
  title = 'Failed to load data',
  hint = 'The backend did not respond. Check that the API server is running, then retry.',
  onRetry,
}: Props) {
  return (
    <EmptyState icon={AlertTriangle} title={title} hint={hint}>
      {onRetry && (
        <Button variant="secondary" size="sm" icon={RotateCcw} onClick={onRetry}>
          Retry
        </Button>
      )}
    </EmptyState>
  )
}
