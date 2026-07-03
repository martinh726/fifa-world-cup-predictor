import { cn } from '../../utils/cn'
import { GlassCard } from './GlassCard'

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('shimmer rounded-lg', className)} aria-hidden="true" />
}

export function CardSkeleton({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <GlassCard className={cn('p-5 space-y-3', className)}>
      <Skeleton className="h-4 w-1/3" />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn('h-3', i % 2 ? 'w-4/5' : 'w-full')} />
      ))}
    </GlassCard>
  )
}
