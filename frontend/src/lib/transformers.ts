/**
 * Data transformation utilities
 * Transforms backend API responses to frontend UI data models
 */

import { WorkflowResponse, WorkflowDetailResponse } from './api'
import { Workflow, WorkflowStep, WorkflowStatus, StepStatus, TriggerType } from './mock-data'

/**
 * Convert backend workflow status to frontend status
 */
function mapWorkflowStatus(backendStatus: 'running' | 'completed' | 'failed'): WorkflowStatus {
    const statusMap: Record<string, WorkflowStatus> = {
        running: 'running',
        completed: 'completed',
        failed: 'failed',
    }
    return statusMap[backendStatus] || 'pending'
}

/**
 * Derive trigger type from workflow data
 * Note: Backend doesn't provide trigger type, so we default to 'agent'
 * This can be enhanced when backend adds trigger type information
 */
function deriveTriggerType(workflow: any): TriggerType {
    // Default to 'agent' since backend doesn't expose trigger type yet
    return 'agent'
}

/**
 * Format Unix timestamp to ISO string for UI
 */
function formatTimestamp(unixTimestamp: number): string {
    return new Date(unixTimestamp * 1000).toISOString()
}

/**
 * Transform backend WorkflowResponse to UI Workflow (minimal data)
 */
export function transformWorkflowListItem(workflow: WorkflowResponse): Workflow {
    return {
        id: workflow.workflowId,
        triggerType: deriveTriggerType(workflow),
        status: mapWorkflowStatus(workflow.status),
        startedAt: formatTimestamp(workflow.startedAt),
        completedAt: workflow.completedAt ? formatTimestamp(workflow.completedAt) : undefined,
        steps: [], // Steps are fetched separately via workflow details
    }
}

/**
 * Transform workflow detail response to UI Workflow with full step data
 */
export function transformWorkflowDetails(detail: WorkflowDetailResponse): Workflow {
    const { workflow, decisions, settlements } = detail

    // Build steps from decisions and settlements
    const steps: WorkflowStep[] = []

    // Step 1: Workflow Started
    steps.push({
        id: `${workflow.workflowId}_start`,
        name: 'Workflow Started',
        timestamp: formatTimestamp(workflow.startedAt),
        status: 'success',
        duration: '0.1s',
    })

    // Steps 2+: Agent decisions
    decisions.forEach((decision, index) => {
        steps.push({
            id: `${workflow.workflowId}_decision_${index}`,
            name: decision.approved ? 'Agent Approval' : 'Agent Rejection',
            timestamp: formatTimestamp(decision.timestamp),
            status: decision.approved ? 'success' : 'failed',
            agentDecisionReason: decision.reason,
            duration: calculateDuration(steps[steps.length - 1]?.timestamp, formatTimestamp(decision.timestamp)),
        })
    })

    // Steps 3+: Settlements
    settlements.forEach((settlement, index) => {
        steps.push({
            id: `${workflow.workflowId}_settlement_${index}`,
            name: 'Settlement Executed',
            timestamp: formatTimestamp(settlement.timestamp),
            status: 'success',
            transactionHash: `0x${settlement.from.slice(2, 10)}...${settlement.to.slice(-8)}`, // Pseudo tx hash
            metadata: {
                from: settlement.from,
                to: settlement.to,
                amount: formatAmount(settlement.amount),
            },
            duration: calculateDuration(steps[steps.length - 1]?.timestamp, formatTimestamp(settlement.timestamp)),
        })
    })

    // Final step: Workflow completion/failure
    if (workflow.completedAt) {
        const finalStatus: StepStatus = workflow.status === 'failed' ? 'failed' : 'success'
        steps.push({
            id: `${workflow.workflowId}_end`,
            name: workflow.status === 'failed' ? 'Workflow Failed' : 'Workflow Completed',
            timestamp: formatTimestamp(workflow.completedAt),
            status: finalStatus,
            errorMessage: workflow.failureReason || undefined,
            duration: calculateDuration(steps[steps.length - 1]?.timestamp, formatTimestamp(workflow.completedAt)),
        })
    }

    return {
        id: workflow.workflowId,
        triggerType: deriveTriggerType(workflow),
        status: mapWorkflowStatus(workflow.status),
        startedAt: formatTimestamp(workflow.startedAt),
        completedAt: workflow.completedAt ? formatTimestamp(workflow.completedAt) : undefined,
        steps,
    }
}

/**
 * Calculate duration between two ISO timestamps
 */
function calculateDuration(start?: string, end?: string): string {
    if (!start || !end) return '0.0s'

    const startTime = new Date(start).getTime()
    const endTime = new Date(end).getTime()
    const durationMs = endTime - startTime

    if (durationMs < 0) return '0.0s'
    if (durationMs < 1000) return `${durationMs}ms`

    const durationSec = (durationMs / 1000).toFixed(1)
    return `${durationSec}s`
}

/**
 * Format amount for display (convert from wei/smallest unit)
 */
function formatAmount(amountString: string): string {
    try {
        const amount = BigInt(amountString)
        const eth = Number(amount) / 1e18
        return `${eth.toFixed(4)} ETH`
    } catch {
        return amountString
    }
}
