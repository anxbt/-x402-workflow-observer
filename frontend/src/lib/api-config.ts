/**
 * API configuration
 * Configure the backend base URL here
 */

export const API_CONFIG = {
    // Backend base URL - update this to match your backend deployment
    baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',

    // Default fetch options
    defaultOptions: {
        headers: {
            'Content-Type': 'application/json',
        },
    },
} as const

/**
 * API endpoints
 */
export const API_ENDPOINTS = {
    health: '/health',
    workflows: '/workflows',
    workflowById: (id: string) => `/workflows/${id}`,
    stats: '/stats',
} as const
