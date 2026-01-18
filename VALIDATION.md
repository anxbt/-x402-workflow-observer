# Deterministic Reconstruction Validation

This document describes how to validate that the x402 Workflow Observer correctly implements deterministic reconstruction from persisted on-chain events.

## Prerequisites

- Backend deployed and running
- Contract deployed to Cronos testnet
- `CONTRACT_ADDRESS` configured in `.env`

## Validation Procedure

### 1. Deploy Contract to Testnet

```bash
cd contracts
forge script script/DeployX402.s.sol --rpc-url https://evm-t3.cronos.org/ --broadcast
```

Note the deployed contract address and update `backend/.env`:

```bash
CONTRACT_ADDRESS=0x<deployed_address>
```

### 2. Execute Test Workflows

Execute 1-2 workflows on-chain to generate events. You can use the contract directly or via a test script.

Example workflow execution:
- Call `startWorkflow()` to initiate
- Call `recordDecision(workflowId, true, "approved")` to approve
- Call `executePayment(workflowId, recipient, amount)` to settle
- Call `completeWorkflow(workflowId)` to finalize

### 3. Confirm Workflows Appear in UI

1. Start the backend:
   ```bash
   cd backend
   bun run dev
   ```

2. Open the frontend at `http://localhost:3001`

3. Verify that executed workflows appear in the dashboard with:
   - Correct workflow IDs
   - Correct status (RUNNING, COMPLETED, etc.)
   - Correct timestamps from blockchain
   - Correct initiator addresses

### 4. Kill Backend

Stop the backend process (Ctrl+C or kill the process).

**Critical observation**: All workflow state currently visible in the UI is stored in the database.

### 5. Restart Backend

Restart the backend:

```bash
cd backend
bun run dev
```

**Watch the startup logs carefully**. You should see:

```
[INFO] Starting event replay...
[INFO] Fetched N events for replay
[INFO] Rebuilding M workflows
[INFO] Event replay complete { eventsProcessed: N, workflowsRebuilt: M, duration: "Xms" }
```

This proves that:
- All `WorkflowState` rows were deleted
- Events were loaded from `ChainEvent` table
- State was rebuilt using the deterministic reducer

### 6. Confirm Workflows Reappear Identically

1. Refresh the frontend at `http://localhost:3001`

2. Verify that **all workflows reappear exactly as before**:
   - Same workflow IDs
   - Same status
   - Same timestamps
   - Same initiators
   - Same ordering

**If workflows reappear identically**, deterministic reconstruction is working correctly.

## What This Validates

✅ **Deterministic reconstruction**: State is rebuilt from events, not cached  
✅ **Immutable event log**: Raw chain events persist across restarts  
✅ **Correct ordering**: Events are replayed in `(blockNumber, txIndex, logIndex)` order  
✅ **Block timestamps**: All timestamps come from `block.timestamp`, not `Date.now()`  
✅ **Idempotency**: Duplicate events are ignored via `(txHash, logIndex)` constraint  
✅ **Polling works**: `eth_getLogs` successfully ingests events on Cronos RPC

## Troubleshooting

### No workflows appear after restart

- Check that events were actually persisted to the database
- Query `ChainEvent` table: `SELECT COUNT(*) FROM "ChainEvent";`
- Check backend logs for replay errors

### Workflows appear but with wrong data

- Check event ordering in database
- Verify reducer logic is deterministic
- Check that timestamps are from `blockTimestamp`, not `createdAt`

### Polling not finding events

- Verify `CONTRACT_ADDRESS` is correct
- Check `lastProcessedBlock` in `SystemState` table
- Ensure `CONFIRMATION_BLOCKS` is not too high for testnet
- Check RPC URL is accessible
