/**
 * API client for x402 backend
 * All fetch functions for backend communication
 */

import { API_CONFIG, API_ENDPOINTS } from './api-config'

/**
 * Base fetch wrapper with error handling
 */
async function apiFetch<T>(endpoint: string): Promise<T> {
    const url = `${API_CONFIG.baseUrl}${endpoint}`

    try {
        const response = await fetch(url, API_CONFIG.defaultOptions)

        if (!response.ok) {
            throw new Error(`API Error: ${response.status} ${response.statusText}`)
        }

        return response.json()
    } catch (error) {
        if (error instanceof Error) {
            throw new Error(`Failed to fetch ${endpoint}: ${error.message}`)
        }
        throw error
    }
}

/**
 * Types matching backend responses
 */

export interface WorkflowResponse {
    workflowId: string
    status: 'running' | 'completed' | 'failed'
    initiator: string
    startedAt: number // Unix timestamp
    completedAt: number | null
}

export interface DecisionResponse {
    approved: boolean
    reason: string
    timestamp: number
}

export interface SettlementResponse {
    from: string
    to: string
    amount: string // BigInt as string
    timestamp: number
}

export interface WorkflowDetailResponse {
    workflow: {
        workflowId: string
        status: 'running' | 'completed' | 'failed'
        initiator: string
        startedAt: number
        completedAt: number | null
        failureReason: string | null
    }
    decisions: DecisionResponse[]
    settlements: SettlementResponse[]
}

export interface StatsResponse {
    total: number
    running: number
    completed: number
    failed: number
}

export interface HealthResponse {
    status: 'ok'
}

/**
 * API functions for each endpoint
 */

export const api = {
    /**
     * GET /health
     * Check backend health status
     */
    getHealth: async (): Promise<HealthResponse> => {
        return apiFetch<HealthResponse>(API_ENDPOINTS.health)
    },

    /**
     * GET /workflows
     * Fetch all workflows
     */
    getWorkflows: async (): Promise<WorkflowResponse[]> => {
        return apiFetch<WorkflowResponse[]>(API_ENDPOINTS.workflows)
    },

    /**
     * GET /workflows/:id
     * Fetch workflow details including decisions and settlements
     */
    getWorkflowById: async (id: string): Promise<WorkflowDetailResponse> => {
        return apiFetch<WorkflowDetailResponse>(API_ENDPOINTS.workflowById(id))
    },

    /**
     * GET /stats
     * Fetch aggregated statistics
     */
    getStats: async (): Promise<StatsResponse> => {
        return apiFetch<StatsResponse>(API_ENDPOINTS.stats)
    },
}
