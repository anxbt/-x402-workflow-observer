/**
 * QueryClient Provider wrapper
 * Configures TanStack Query for the application
 */

'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactNode, useState } from 'react'

export function QueryProvider({ children }: { children: ReactNode }) {
    const [queryClient] = useState(
        () =>
            new QueryClient({
                defaultOptions: {
                    queries: {
                        // Don't refetch on window focus in development
                        refetchOnWindowFocus: process.env.NODE_ENV === 'production',
                        // Retry failed requests
                        retry: 2,
                        // Keep unused data in cache for 5 minutes
                        gcTime: 5 * 60 * 1000,
                    },
                },
            })
    )

    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}
