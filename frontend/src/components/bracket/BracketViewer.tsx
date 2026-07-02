import { useQuery } from '@tanstack/react-query'
import { fetchBracketSvg } from '../../api'
import { BrandArcPattern } from '../shared/BrandArcPattern'

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
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 flex items-center justify-center h-32">
        <BrandArcPattern variant="full" opacity={0.15} className="absolute inset-0 w-full h-full" />
        <span className="relative text-slate-500 text-sm">Loading bracket…</span>
      </div>
    )
  }

  if (error || !svgString) {
    return (
      <div className="relative overflow-hidden bg-white border border-slate-200 rounded-xl p-4 text-slate-500 text-sm">
        <BrandArcPattern variant="corner" opacity={0.12} className="absolute top-0 right-0 w-24 h-24" />
        <span className="relative">
          {type === 'simulated'
            ? 'Run the simulator first to see the bracket.'
            : 'Bracket not available yet.'}
        </span>
      </div>
    )
  }

  return (
    <div
      className="overflow-x-auto bg-white border border-slate-200 rounded-xl p-3 shadow-sm"
      dangerouslySetInnerHTML={{ __html: svgString }}
    />
  )
}
