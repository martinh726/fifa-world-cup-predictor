import { useQuery } from '@tanstack/react-query'
import { fetchResults } from '../api'

export function useResultsPolling(enabled = true) {
  return useQuery({
    queryKey: ['results'],
    queryFn: fetchResults,
    refetchInterval: enabled ? 5 * 60_000 : false,
    refetchIntervalInBackground: false,
    staleTime: 4 * 60_000,
  })
}
