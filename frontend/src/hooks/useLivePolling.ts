import { useQuery } from '@tanstack/react-query'
import { fetchLive } from '../api'

export function useLivePolling() {
  return useQuery({
    queryKey: ['live'],
    queryFn: fetchLive,
    refetchInterval: 30_000,
    refetchIntervalInBackground: false,
    staleTime: 25_000,
  })
}
