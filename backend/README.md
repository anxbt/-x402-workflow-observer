# x402 Backend - Deterministic Workflow Observer

**This system performs deterministic reconstruction from on-chain events. All workflow state is derived via replay and can be rebuilt at any time.**

## Purpose

This backend provides **observability-only** functionality for x402 payment workflows:
- ✅ Listens to smart contract events on Cronos
- ✅ Stores events in immutable append-only log
- ✅ Derives workflow state deterministically
- ✅ Exposes read-only APIs
- ❌ Does NOT execute workflows
- ❌ Does NOT trigger payments

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cronos EVM (Testnet)                    │
│                  Smart Contract Events                      │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ WebSocket/HTTP Polling
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                   Backend (Node.js)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Event Listener (listener.js)                        │   │
│  │  - Subscribes to contract events                     │   │
│  │  - Fetches ordering metadata (block, tx, log index)  │   │
│  │  - 3-block confirmation delay (reorg safety)         │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ChainEvent Table (Postgres)                         │   │
│  │  - Immutable append-only event log                   │   │
│  │  - Ordered by (blockNumber, txIndex, logIndex)       │   │
│  │  - Idempotent writes (unique constraint)             │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  Deterministic Reducer (reducer.js)                  │   │
│  │  - Pure function: state = f(events)                  │   │
│  │  - No Date.now(), uses block.timestamp               │   │
│  │  - Derives WorkflowState from ChainEvent             │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  WorkflowState Table (Postgres)                      │   │
│  │  - Materialized view (rebuildable)                   │   │
│  │  - Current status of each workflow                   │   │
│  └────────────┬─────────────────────────────────────────┘   │
│               │                                              │
│               ▼                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  REST API (Express)                                  │   │
│  │  - GET /workflows                                    │   │
│  │  - GET /workflows/:id                                │   │
│  │  - GET /stats                                        │   │
│  │  - GET /health/db                                    │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────┬────────────────────────────────────┘
                         │
                         │ HTTP/JSON
                         ▼
┌─────────────────────────────────────────────────────────────┐
│              Frontend (Next.js + TanStack Query)            │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Dependencies

```bash
cd backend
bun install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Update `.env` with your values:

```bash
# Blockchain Configuration
RPC_URL=https://evm-t3.cronos.org/
CHAIN_ID=338
CONTRACT_ADDRESS=0x...
BLOCK_START=0

# Database Configuration (REQUIRED)
DATABASE_URL=postgresql://user:pass@host:port/database

# Reorg Safety
CONFIRMATION_BLOCKS=3
```

### 3. Run Database Migrations

```bash
bunx prisma migrate deploy
```

### 4. Start the Server

```bash
bun run dev
```

The server will:
1. Connect to PostgreSQL
2. Replay all events from `BLOCK_START` (deterministic reconstruction)
3. Start listening for new events
4. Serve API on `http://localhost:3000`

## API Endpoints

### Health Checks

```bash
GET /health
# Returns: { "status": "ok" }

GET /health/db
# Returns: { "status": "ok", "db": "connected" }
```

### Workflows

```bash
GET /workflows?limit=100&offset=0
# Returns paginated list of workflows
```

Response:
```json
[
  {
    "workflowId": "0x...",
    "status": "completed",
    "initiator": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "startedAt": 1702934400,
    "completedAt": 1702935000
  }
]
```

### Workflow Details

```bash
GET /workflows/:id
# Returns workflow with full event timeline
```

Response:
```json
{
  "workflow": {
    "workflowId": "0x...",
    "status": "completed",
    "initiator": "0x...",
    "startedAt": 1702934400,
    "completedAt": 1702935000,
    "failureReason": null
  },
  "decisions": [
    {
      "approved": true,
      "reason": "Payment verified",
      "timestamp": 1702934500
    }
  ],
  "settlements": [
    {
      "from": "0x...",
      "to": "0x...",
      "amount": "1000000000000000000",
      "timestamp": 1702934600
    }
  ]
}
```

### Statistics

```bash
GET /stats
# Returns aggregated workflow counts
```

Response:
```json
{
  "total": 42,
  "running": 3,
  "completed": 38,
  "failed": 1
}
```

## Deterministic Reconstruction

### How It Works

1. **Immutable Event Log**: All on-chain events are stored in `ChainEvent` table with ordering metadata
2. **Canonical Ordering**: Events are sorted by `(blockNumber, transactionIndex, logIndex)`
3. **Pure Reducer**: Workflow state is derived via pure function: `state = f(events)`
4. **Rebuildable**: `WorkflowState` can be deleted and rebuilt from `ChainEvent` at any time

### Replay on Startup

Every time the backend starts:
```
1. Connect to database
2. Query all ChainEvent rows (ordered)
3. Clear WorkflowState table
4. Apply reducer to rebuild all workflow states
5. Start listening for new events
```

This ensures **deterministic reconstruction** - the same events always produce the same state.

### Reorg Safety

- Events are only processed after `CONFIRMATION_BLOCKS` confirmations (default: 3)
- Unconfirmed events are ignored
- This prevents state corruption from chain reorganizations

## Database Schema

### ChainEvent (Immutable)

```sql
CREATE TABLE ChainEvent (
  id UUID PRIMARY KEY,
  workflowId VARCHAR(66),
  eventType ENUM('WORKFLOW_STARTED', 'DECISION_RECORDED', ...),
  payload JSONB,
  blockNumber BIGINT,
  transactionIndex INT,
  logIndex INT,
  txHash VARCHAR(66),
  blockHash VARCHAR(66),
  blockTimestamp BIGINT,
  createdAt TIMESTAMP,
  UNIQUE (txHash, logIndex)
);

CREATE INDEX ON ChainEvent (blockNumber, transactionIndex, logIndex);
```

### WorkflowState (Derived)

```sql
CREATE TABLE WorkflowState (
  workflowId VARCHAR(66) PRIMARY KEY,
  status ENUM('RUNNING', 'COMPLETED', 'FAILED', 'REJECTED'),
  initiator VARCHAR(42),
  startedAt BIGINT,
  completedAt BIGINT,
  failureReason TEXT,
  lastEventBlock BIGINT,
  lastEventLogIndex INT
);
```

## Tech Stack

- **Runtime**: Bun
- **Framework**: Express.js
- **Blockchain**: ethers.js v6
- **Database**: PostgreSQL (Neon)
- **ORM**: Prisma
- **Chain**: Cronos Testnet

## Current Limitations

### Scope

- **On-chain events only**: No facilitator/orchestrator ingestion yet
- **Testnet deployment**: Not production-ready
- **No authentication**: All endpoints are public
- **No WebSockets**: Polling-based updates only

### Known Issues

- **No historical backfill**: Events before `BLOCK_START` are not indexed
- **No pagination on events**: Large workflows may have performance issues
- **No caching**: All queries hit database directly

## Production Roadmap

To make this production-ready:

### 1. Scalability

- [ ] Add Redis for caching
- [ ] Implement event pagination
- [ ] Add database connection pooling
- [ ] Consider The Graph for indexing

### 2. Reliability

- [ ] Add retry logic for RPC failures
- [ ] Implement circuit breakers
- [ ] Add distributed tracing (Datadog/Sentry)
- [ ] Add metrics (Prometheus)

### 3. Security

- [ ] Implement rate limiting
- [ ] Add API authentication (JWT)
- [ ] Add request validation (Zod)
- [ ] Enable CORS properly

### 4. Observability

- [ ] Add structured logging
- [ ] Add performance monitoring
- [ ] Add alerting for failures
- [ ] Add dashboard for replay progress

## Development

### Project Structure

```
src/
├── server.js             # Bootstrap & startup sequence
├── index.js              # Express app setup
├── config.js             # Environment & constants
├── blockchain/
│   ├── provider.js       # ethers.js provider
│   ├── contract.js       # Contract ABI & address
│   └── listener.js       # Event listeners (with persistence)
├── db/
│   ├── db.js             # Prisma client & connection
│   ├── reducer.js        # Deterministic state reducer
│   └── replay.js         # Event replay logic
├── routes/
│   └── workflows.js      # API routes
└── utils/
    └── logger.js         # Simple logger
```

### Adding New Events

1. Add event signature to `src/blockchain/contract.js`
2. Add event handler in `src/blockchain/listener.js`
3. Update reducer in `src/db/reducer.js`
4. Update Prisma schema if needed
5. Run migration: `bunx prisma migrate dev`

### Testing Determinism

```bash
# 1. Start server (replay happens)
bun run dev

# 2. Note workflow count
curl http://localhost:3000/stats

# 3. Restart server
# 4. Verify same workflow count (deterministic!)
curl http://localhost:3000/stats
```

## License

MIT
