# x402 Frontend - Observability Dashboard

Read-only observability dashboard for x402 payment workflows. Built with Next.js and TanStack Query.

## Quick Start

### 1. Install Dependencies

```bash
cd frontend
bun install
```

### 2. Configure Environment

Create `.env.local` file:

```bash
cp .env.local.example .env.local
```

Update the backend URL if needed:
```
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 3. Run the Development Server

```bash
bun run dev
```

The frontend will be available at `http://localhost:3001` (or the next available port).

## Architecture

### Data Flow

```
Backend API → TanStack Query Hooks → Data Transformers → UI Components
```

1. **API Layer** (`src/lib/api.ts`)
   - Type-safe fetch functions for all backend endpoints
   - Error handling and response parsing

2. **Query Hooks** (`src/hooks/`)
   - `useWorkflows` - Fetches workflow list
   - `useWorkflowDetails` - Fetches workflow details with decisions and settlements
   - `useStats` - Fetches aggregated statistics
   - `useHealth` - Backend health check

3. **Data Transformers** (`src/lib/transformers.ts`)
   - Converts backend API responses to UI data models
   - Builds step timeline from decisions and settlements

4. **UI Components** (`src/components/`)
   - `workflow-list.tsx` - Displays workflows in table format
   - `execution-timeline.tsx` - Shows step-by-step execution
   - `step-inspection.tsx` - Detailed step information

### Backend Configuration

The backend URL is configured in `src/lib/api-config.ts`:

```typescript
export const API_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
}
```

To change the backend URL:
1. Set `NEXT_PUBLIC_API_URL` in `.env.local`
2. Or modify the default in `api-config.ts`

## Features

- ✅ Real-time workflow monitoring (auto-refresh every 3-5 seconds)
- ✅ Workflow list with status, trigger type, and timestamps
- ✅ Detailed execution timeline
- ✅ Step-by-step inspection with metadata
- ✅ Backend health monitoring
- ✅ Loading and error states
- ✅ Responsive layout optimized for 1280px+ displays

## API Integration

### Endpoints Used

| Endpoint | Hook | Refetch Interval | Purpose |
|----------|------|------------------|---------|
| `GET /health` | `useHealth` | 10s | Backend health check |
| `GET /workflows` | `useWorkflows` | 5s | List all workflows |
| `GET /workflows/:id` | `useWorkflowDetails` | 3s | Get workflow details |
| `GET /stats` | `useStats` | 5s | Aggregated statistics |

### Data Transformations

The backend returns minimal data optimized for storage. The frontend transforms this into rich UI models:

**Backend Workflow:**
```json
{
  "workflowId": "1",
  "status": "completed",
  "initiator": "0x742d35Cc...",
  "startedAt": 1702934400,
  "completedAt": 1702935000
}
```

**Frontend Workflow:**
```typescript
{
  id: "1",
  triggerType: "agent",
  status: "completed",
  startedAt: "2024-01-15T14:32:11Z",
  completedAt: "2024-01-15T14:32:47Z",
  steps: [
    // Built from decisions + settlements
  ]
}
```

### Auto-Refresh Behavior

All queries use TanStack Query's `refetchInterval` for real-time updates:
- Workflows: 5 seconds
- Workflow details: 3 seconds
- Stats: 5 seconds
- Health: 10 seconds

Stale time is set slightly lower than refetch interval to ensure fresh data on user interaction.

## Tech Stack

- **Framework:** Next.js 15 with App Router
- **Language:** TypeScript
- **Data Fetching:** TanStack Query v5
- **UI Components:** Radix UI primitives
- **Styling:** Tailwind CSS 4
- **Runtime:** Bun

## Project Structure

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx        # Root layout with QueryProvider
│   │   └── page.tsx          # Dashboard page (uses real API)
│   ├── lib/
│   │   ├── api-config.ts     # API configuration
│   │   ├── api.ts            # API client functions
│   │   ├── transformers.ts   # Data transformers
│   │   ├── mock-data.ts      # Mock data types (for reference)
│   │   └── QueryProvider.tsx # TanStack Query setup
│   ├── hooks/
│   │   ├── useWorkflows.ts
│   │   ├── useWorkflowDetails.ts
│   │   ├── useStats.ts
│   │   └── useHealth.ts
│   └── components/
│       ├── workflow-list.tsx
│       ├── execution-timeline.tsx
│       └── step-inspection.tsx
├── .env.local.example
└── package.json
```

## Non-Features (By Design)

- ❌ No wallet connections
- ❌ No POST/PUT/DELETE requests
- ❌ No workflow execution from frontend
- ❌ No authentication
- ❌ No pagination (backend returns all workflows)
- ❌ No WebSocket or real-time subscriptions (using polling instead)

## Error Handling

The dashboard gracefully handles:
- Backend unavailable (shows "Disconnected" status)
- Failed API requests (displays error message with retry guidance)
- Missing data (shows loading states)
- Network timeouts (automatic retry via TanStack Query)

## Development

### Adding New Endpoints

1. Add endpoint definition to `src/lib/api-config.ts`
2. Add response type and fetch function to `src/lib/api.ts`
3. Create query hook in `src/hooks/`
4. Use hook in component

Example:
```typescript
// api.ts
export const api = {
  getNewData: async () => apiFetch('/new-endpoint'),
}

// useNewData.ts
export function useNewData() {
  return useQuery({
    queryKey: ['newData'],
    queryFn: api.getNewData,
  })
}

// page.tsx
const { data } = useNewData()
```

### Customizing Refresh Intervals

Edit the `refetchInterval` in hook files:

```typescript
// Faster updates (1 second)
refetchInterval: 1000

// Slower updates (30 seconds)
refetchInterval: 30000

// Disable auto-refresh
refetchInterval: false
```

## Troubleshooting

### "Failed to load workflows"

Make sure:
1. Backend is running on `http://localhost:3000`
2. `NEXT_PUBLIC_API_URL` is correct
3. CORS is enabled on backend (should be by default)

### Data not updating

1. Check browser console for errors
2. Verify backend is emitting events
3. Check network tab for failed requests
4. Ensure `refetchInterval` is set in hooks

### TypeScript errors

Run type check:
```bash
bun run tsc --noEmit
```

## License

MIT
