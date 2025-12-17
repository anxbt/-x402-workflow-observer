/**
 * React Query hook for fetching all workflows
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { api, WorkflowResponse } from '@/lib/api'

export const QUERY_KEYS = {
    workflows: ['workflows'] as const,
}

export function useWorkflows() {
    return useQuery<WorkflowResponse[], Error>({
        queryKey: QUERY_KEYS.workflows,
        queryFn: api.getWorkflows,
        refetchInterval: 5000, // Refetch every 5 seconds for real-time updates
        staleTime: 3000, // Consider data stale after 3 seconds
    })
}
