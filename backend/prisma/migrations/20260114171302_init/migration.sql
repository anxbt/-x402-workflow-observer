-- CreateEnum
CREATE TYPE "EventType" AS ENUM ('WORKFLOW_STARTED', 'DECISION_RECORDED', 'PAYMENT_EXECUTED', 'WORKFLOW_COMPLETED', 'WORKFLOW_FAILED');

-- CreateEnum
CREATE TYPE "WorkflowStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED', 'REJECTED');

-- CreateTable
CREATE TABLE "ChainEvent" (
    "id" TEXT NOT NULL,
    "workflowId" VARCHAR(66) NOT NULL,
    "eventType" "EventType" NOT NULL,
    "payload" JSONB NOT NULL,
    "blockNumber" BIGINT NOT NULL,
    "transactionIndex" INTEGER NOT NULL,
    "logIndex" INTEGER NOT NULL,
    "txHash" VARCHAR(66) NOT NULL,
    "blockHash" VARCHAR(66) NOT NULL,
    "blockTimestamp" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChainEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkflowState" (
    "workflowId" VARCHAR(66) NOT NULL,
    "status" "WorkflowStatus" NOT NULL,
    "initiator" VARCHAR(42) NOT NULL,
    "startedAt" BIGINT NOT NULL,
    "completedAt" BIGINT,
    "failureReason" TEXT,
    "lastEventBlock" BIGINT NOT NULL,
    "lastEventLogIndex" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkflowState_pkey" PRIMARY KEY ("workflowId")
);

-- CreateTable
CREATE TABLE "system_state" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "lastProcessedBlock" BIGINT NOT NULL DEFAULT 0,
    "confirmationBlocks" INTEGER NOT NULL DEFAULT 3,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "system_state_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChainEvent_blockNumber_transactionIndex_logIndex_idx" ON "ChainEvent"("blockNumber", "transactionIndex", "logIndex");

-- CreateIndex
CREATE INDEX "ChainEvent_workflowId_idx" ON "ChainEvent"("workflowId");

-- CreateIndex
CREATE UNIQUE INDEX "ChainEvent_txHash_logIndex_key" ON "ChainEvent"("txHash", "logIndex");
