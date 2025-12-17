# x402 Backend - Payment Workflow Debugger

Minimal, production-sane backend for observability of x402 payment workflows.

## Purpose

This backend is **observability-only**:
- ✅ Listens to smart contract events
- ✅ Normalizes them into queryable state
- ✅ Exposes read-only APIs
- ❌ Does NOT execute workflows
- ❌ Does NOT trigger payments

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
- `RPC_URL`: WebSocket or HTTP RPC endpoint (e.g., Alchemy, Infura)
- `CONTRACT_ADDRESS`: Deployed x402 contract address
- `BLOCK_START`: Block number to start listening from (optional)

### 3. Run the Server

```bash
bun run src/server.js
```

Or use the npm script:

```bash
bun run dev
```

The server will start on `http://localhost:3000` (configurable via `PORT` env var).

## API Endpoints

### Health Check
```bash
GET /health
```

Returns:
```json
{
  "status": "ok"
}
```

### List Workflows
```bash
GET /workflows
```

Returns array of workflows:
```json
[
  {
    "workflowId": "1",
    "status": "completed",
    "initiator": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "startedAt": 1702934400,
    "completedAt": 1702935000
  }
]
```

### Get Workflow Details
```bash
GET /workflows/:id
```

Returns:
```json
{
  "workflow": {
    "workflowId": "1",
    "status": "completed",
    "initiator": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
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
      "from": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "to": "0x1234567890abcdef1234567890abcdef12345678",
      "amount": "1000000000000000000",
      "timestamp": 1702934600
    }
  ]
}
```

### Get Statistics
```bash
GET /stats
```

Returns:
```json
{
  "total": 42,
  "running": 3,
  "completed": 38,
  "failed": 1
}
```

## Architecture

```
src/
├── index.js              # Express app setup
├── server.js             # Bootstrap & startup sequence
├── config.js             # Environment & constants
├── blockchain/
│   ├── provider.js       # ethers.js provider
│   ├── contract.js       # Contract ABI & address
│   └── listener.js       # Event listeners
├── store/
│   └── memoryStore.js    # In-memory state (Map-based)
├── routes/
│   └── workflows.js      # API routes
└── utils/
    └── logger.js         # Simple logger
```

## Smart Contract Events

The backend listens to these events:

1. **WorkflowStarted** - New workflow initiated
2. **AgentDecisionRecorded** - Agent approved/rejected
3. **SettlementExecuted** - Payment executed
4. **WorkflowCompleted** - Workflow successful
5. **WorkflowFailed** - Workflow failed

## Tech Stack

- **Runtime**: Bun
- **Framework**: Express.js
- **Blockchain**: ethers.js v6
- **Storage**: In-memory (Map-based)

## Limitations & Future Work

### Current Limitations

1. **In-Memory Storage**: Data is lost on restart
2. **No Event Replay**: Historical events not loaded on startup
3. **No Persistence**: No database integration yet
4. **No Authentication**: All endpoints are public

### Production Roadmap

To make this production-ready:

1. **Add Persistence**
   - Replace `memoryStore.js` with PostgreSQL or MongoDB
   - Add event replay from `BLOCK_START`
   - Implement checkpoint storage

2. **Improve Reliability**
   - Add reorg handling
   - Implement retry logic for RPC failures
   - Add event deduplication

3. **Add Observability**
   - Replace simple logger with Datadog/Sentry
   - Add metrics (Prometheus)
   - Add distributed tracing

4. **Add Security**
   - Implement rate limiting
   - Add API authentication
   - Add request validation

5. **Scale**
   - Use Redis for caching
   - Add load balancing
   - Consider The Graph for indexing

## Development

### Project Structure

Each file has a header comment explaining its role. The codebase favors:
- ✅ Clarity over abstraction
- ✅ Linear flow over clever patterns
- ✅ Explicit over implicit
- ✅ Comments explaining "why" not "what"

### Adding New Events

1. Add event signature to `src/blockchain/contract.js`
2. Add event handler in `src/blockchain/listener.js`
3. Update store methods in `src/store/memoryStore.js`
4. Expose via API in `src/routes/workflows.js`

## License

MIT
