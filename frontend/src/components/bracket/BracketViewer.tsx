import { useQuery } from '@tanstack/react-query'
import { fetchBracketSvg } from '../../api'

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
    return (
      <div className="bg-slate-900 rounded-xl p-4 flex items-center justify-center h-32">
        <span className="text-slate-400 text-sm">Loading bracket…</span>
      </div>
    )
  }

  if (error || !svgString) {
    return (
      <div className="bg-slate-900 rounded-xl p-4 text-slate-400 text-sm">
        {type === 'simulated'
          ? 'Run the simulator first to see the bracket.'
          : 'Bracket not available yet.'}
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto bg-slate-900 rounded-xl p-3"
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}
