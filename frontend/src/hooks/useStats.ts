/**
 * React Query hook for fetching workflow statistics
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { api, StatsResponse } from '@/lib/api'

export const QUERY_KEYS = {
    stats: ['stats'] as const,
}

export function useStats() {
    return useQuery<StatsResponse, Error>({
        queryKey: QUERY_KEYS.stats,
        queryFn: api.getStats,
        refetchInterval: 5000, // Refetch every 5 seconds
        staleTime: 3000, // Consider data stale after 3 seconds
    })
}
