import { useQuery } from '@tanstack/react-query'
import { fetchBracketSvg } from '../../api'
import { Skeleton } from '../ui/Skeleton'

interface Props {
  type: 'simulated' | 'live'
}

export function BracketViewer({ type }: Props) {
  const { data: svgString, isLoading, error } = useQuery({
    queryKey: ['bracket-svg', type],
    queryFn: () => fetchBracketSvg(type),
    staleTime: type === 'live' ? 30_000 : 60_000,
    retry: false,
  })

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-xl" />
  }

  if (error || !svgString) {
    return (
      <div className="rounded-xl p-4 text-ink-400 text-sm bg-ink-950/40 border border-white/[0.06]">
        {type === 'simulated'
          ? 'Run the simulator first to see the bracket.'
          : 'Bracket not available yet.'}
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto rounded-xl bg-ink-950/40 border border-white/[0.06] p-2"
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}
