// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title X402HelloWorld
/// @notice A minimal reference implementation demonstrating payment as a workflow
/// @dev This contract demonstrates a 4-phase lifecycle: Intent → Decision → Settlement → Finality
/// Purpose: observability and lifecycle clarity for hackathon, not production optimization
contract X402HelloWorld {
    // ============================================================================
    // TYPES & STORAGE
    // ============================================================================

    /// @notice Workflow lifecycle states
    /// @dev Each workflow progresses linearly through these states
    enum WorkflowState {
        None, // Workflow does not exist
        Active, // Workflow started, awaiting decision
        Approved, // Decision approved, ready for settlement
        Rejected, // Decision rejected, workflow failed
        Settled, // Payment executed, awaiting completion
        Completed, // Workflow successfully completed
        Failed // Workflow failed at any stage
    }

    /// @notice Minimal on-chain storage for each workflow
    /// @dev Prefer events over state - this is just enough to enforce lifecycle rules
    struct Workflow {
        WorkflowState state;
        address initiator;
        uint256 amount;
    }

    /// @notice Counter for generating unique workflow IDs
    uint256 private workflowCounter;

    /// @notice Mapping of workflow ID to workflow data
    mapping(bytes32 => Workflow) public workflows;

    // ============================================================================
    // EVENTS - Primary observability mechanism
    // ============================================================================

    /// @notice Phase 1: Intent - A new workflow has been started
    /// @param workflowId Unique identifier for this workflow
    /// @param initiator Address that started the workflow
    event WorkflowStarted(
        bytes32 indexed workflowId,
        address indexed initiator
    );

    /// @notice Phase 2: Decision - Agent-style decision recorded
    /// @param workflowId The workflow being decided upon
    /// @param approved Whether the workflow was approved
    /// @param reason Human-readable explanation for the decision
    event DecisionRecorded(
        bytes32 indexed workflowId,
        bool approved,
        string reason
    );

    /// @notice Phase 3: Settlement - ETH payment executed
    /// @param workflowId The workflow being settled
    /// @param to Recipient address
    /// @param amount Amount of ETH transferred
    event PaymentExecuted(
        bytes32 indexed workflowId,
        address indexed to,
        uint256 amount
    );

    /// @notice Phase 4: Finality - Workflow successfully completed
    /// @param workflowId The workflow that completed
    event WorkflowCompleted(bytes32 indexed workflowId);

    /// @notice Workflow failure event
    /// @param workflowId The workflow that failed
    /// @param reason Explanation for failure
    event WorkflowFailed(bytes32 indexed workflowId, string reason);

    // ============================================================================
    // ERRORS - Explicit failure modes
    // ============================================================================

    error WorkflowNotFound(bytes32 workflowId);
    error WorkflowNotActive(bytes32 workflowId, WorkflowState currentState);
    error WorkflowNotApproved(bytes32 workflowId, WorkflowState currentState);
    error WorkflowNotSettled(bytes32 workflowId, WorkflowState currentState);
    error InsufficientPayment(uint256 provided, uint256 required);
    error PaymentFailed(address to, uint256 amount);

    // ============================================================================
    // PHASE 1: INTENT - Start a workflow
    // ============================================================================

    /// @notice Start a new payment workflow
    /// @dev Creates a workflow in Active state, ready for decision
    /// @return workflowId Unique identifier for this workflow
    function startWorkflow() external returns (bytes32 workflowId) {
        // Generate unique workflow ID
        workflowCounter++;
        workflowId = keccak256(
            abi.encodePacked(msg.sender, workflowCounter, block.timestamp)
        );

        // Initialize workflow in Active state
        workflows[workflowId] = Workflow({
            state: WorkflowState.Active,
            initiator: msg.sender,
            amount: 0
        });

        // Emit event for observability
        emit WorkflowStarted(workflowId, msg.sender);
    }

    // ============================================================================
    // PHASE 2: DECISION - Agent-style approval/rejection
    // ============================================================================

    /// @notice Record a decision for a workflow
    /// @dev Decision can approve (allowing settlement) or reject (failing workflow)
    /// @param workflowId The workflow to decide upon
    /// @param approve True to approve, false to reject
    /// @param reason Human-readable explanation for the decision
    function recordDecision(
        bytes32 workflowId,
        bool approve,
        string calldata reason
    ) external {
        Workflow storage workflow = workflows[workflowId];

        // Workflow must exist and be active
        if (workflow.state == WorkflowState.None) {
            revert WorkflowNotFound(workflowId);
        }
        if (workflow.state != WorkflowState.Active) {
            revert WorkflowNotActive(workflowId, workflow.state);
        }

        // Emit decision event for observability (must come before WorkflowFailed)
        emit DecisionRecorded(workflowId, approve, reason);

        // Update state based on decision
        if (approve) {
            workflow.state = WorkflowState.Approved;
        } else {
            workflow.state = WorkflowState.Rejected;
            emit WorkflowFailed(workflowId, reason);
        }
    }

    // ============================================================================
    // PHASE 3: SETTLEMENT - Execute ETH transfer
    // ============================================================================

    /// @notice Execute payment for an approved workflow
    /// @dev Only works if workflow is approved; transfers ETH to recipient
    /// @param workflowId The workflow to settle
    /// @param to Address to receive payment
    function executePayment(
        bytes32 workflowId,
        address payable to
    ) external payable {
        Workflow storage workflow = workflows[workflowId];

        // Workflow must be approved to settle
        if (workflow.state == WorkflowState.None) {
            revert WorkflowNotFound(workflowId);
        }
        if (workflow.state != WorkflowState.Approved) {
            revert WorkflowNotApproved(workflowId, workflow.state);
        }

        // Must send ETH
        if (msg.value == 0) {
            revert InsufficientPayment(msg.value, 1);
        }

        // Store amount for observability
        workflow.amount = msg.value;

        // Transfer ETH to recipient
        (bool success, ) = to.call{value: msg.value}("");
        if (!success) {
            workflow.state = WorkflowState.Failed;
            emit WorkflowFailed(workflowId, "ETH transfer failed");
            revert PaymentFailed(to, msg.value);
        }

        // Update state to settled
        workflow.state = WorkflowState.Settled;

        // Emit event for observability
        emit PaymentExecuted(workflowId, to, msg.value);
    }

    // ============================================================================
    // PHASE 4: FINALITY - Complete the workflow
    // ============================================================================

    /// @notice Complete a settled workflow
    /// @dev Final step in the workflow lifecycle
    /// @param workflowId The workflow to complete
    function completeWorkflow(bytes32 workflowId) external {
        Workflow storage workflow = workflows[workflowId];

        // Workflow must be settled to complete
        if (workflow.state == WorkflowState.None) {
            revert WorkflowNotFound(workflowId);
        }
        if (workflow.state != WorkflowState.Settled) {
            revert WorkflowNotSettled(workflowId, workflow.state);
        }

        // Mark as completed
        workflow.state = WorkflowState.Completed;

        // Emit final event
        emit WorkflowCompleted(workflowId);
    }

    // ============================================================================
    // VIEW FUNCTIONS
    // ============================================================================

    /// @notice Get the current state of a workflow
    /// @param workflowId The workflow to query
    /// @return The current workflow state
    function getWorkflowState(
        bytes32 workflowId
    ) external view returns (WorkflowState) {
        return workflows[workflowId].state;
    }
}
