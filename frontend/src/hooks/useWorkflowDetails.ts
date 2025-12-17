/**
 * React Query hook for fetching workflow details
 */

'use client'

import { useQuery } from '@tanstack/react-query'
import { api, WorkflowDetailResponse } from '@/lib/api'

export const QUERY_KEYS = {
    workflowDetail: (id: string) => ['workflow', id] as const,
}

export function useWorkflowDetails(workflowId: string | null) {
    return useQuery<WorkflowDetailResponse, Error>({
        queryKey: QUERY_KEYS.workflowDetail(workflowId || ''),
        queryFn: () => api.getWorkflowById(workflowId!),
        enabled: !!workflowId, // Only fetch when workflowId is provided
        refetchInterval: 3000, // Refetch every 3 seconds for real-time updates
        staleTime: 2000, // Consider data stale after 2 seconds
    })
}
