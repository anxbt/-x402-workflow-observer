/**
 * React Query hook for health check
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { api, HealthResponse } from '@/lib/api'

export const QUERY_KEYS = {
    health: ['health'] as const,
}

export function useHealth() {
    return useQuery<HealthResponse, Error>({
        queryKey: QUERY_KEYS.health,
        queryFn: api.getHealth,
        refetchInterval: 10000, // Check health every 10 seconds
        staleTime: 8000,
        retry: 3, // Retry on failure
    })
}
