// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../src/X402HelloWorld.sol";

/// @title X402HelloWorld Test Suite
/// @notice Comprehensive tests for the X402 payment workflow
/// @dev Tests cover both success paths and failure modes, with emphasis on event emissions
contract X402HelloWorldTest is Test {
    X402HelloWorld public workflow;

    address public alice;
    address public bob;

    // Events we expect to observe (must match contract definitions)
    event WorkflowStarted(
        bytes32 indexed workflowId,
        address indexed initiator
    );
    event DecisionRecorded(
        bytes32 indexed workflowId,
        bool approved,
        string reason
    );
    event PaymentExecuted(
        bytes32 indexed workflowId,
        address indexed to,
        uint256 amount
    );
    event WorkflowCompleted(bytes32 indexed workflowId);
    event WorkflowFailed(bytes32 indexed workflowId, string reason);

    function setUp() public {
        // Deploy the workflow contract
        workflow = new X402HelloWorld();

        // Create test users
        alice = makeAddr("alice");
        bob = makeAddr("bob");

        // Fund alice for payment tests
        vm.deal(alice, 10 ether);
    }

    // ============================================================================
    // SUCCESS PATH TESTS
    // ============================================================================

    /// @notice Test: Complete happy path workflow
    /// @dev Validates all 4 phases execute correctly: Intent → Decision → Settlement → Finality
    function test_CompleteWorkflowSuccessPath() public {
        // PHASE 1: INTENT - Start workflow
        vm.startPrank(alice);

        // Expect WorkflowStarted event
        vm.expectEmit(false, true, false, false);
        emit WorkflowStarted(bytes32(0), alice); // workflowId is generated, so we check other fields

        bytes32 workflowId = workflow.startWorkflow();

        // Verify workflow is in Active state
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Active)
        );

        // PHASE 2: DECISION - Approve
        string memory approvalReason = "Payment authorized by agent";

        // Expect DecisionRecorded event
        vm.expectEmit(true, false, false, true);
        emit DecisionRecorded(workflowId, true, approvalReason);

        workflow.recordDecision(workflowId, true, approvalReason);

        // Verify workflow is now Approved
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Approved)
        );

        // PHASE 3: SETTLEMENT - Execute payment
        uint256 paymentAmount = 1 ether;
        uint256 bobBalanceBefore = bob.balance;

        // Expect PaymentExecuted event
        vm.expectEmit(true, true, false, true);
        emit PaymentExecuted(workflowId, bob, paymentAmount);

        workflow.executePayment{value: paymentAmount}(workflowId, payable(bob));

        // Verify ETH was transferred
        assertEq(bob.balance, bobBalanceBefore + paymentAmount);

        // Verify workflow is now Settled
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Settled)
        );

        // PHASE 4: FINALITY - Complete workflow
        vm.expectEmit(true, false, false, false);
        emit WorkflowCompleted(workflowId);

        workflow.completeWorkflow(workflowId);

        // Verify workflow is now Completed
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Completed)
        );

        vm.stopPrank();
    }

    /// @notice Test: Workflow can be started
    /// @dev Validates Phase 1: Intent
    function test_StartWorkflow() public {
        vm.startPrank(alice);

        // Expect WorkflowStarted event
        vm.expectEmit(false, true, false, false);
        emit WorkflowStarted(bytes32(0), alice);

        bytes32 workflowId = workflow.startWorkflow();

        // Workflow should exist and be active
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Active)
        );

        vm.stopPrank();
    }

    /// @notice Test: Approved decision allows settlement
    /// @dev Validates Phase 2: Decision (approval path)
    function test_ApprovedDecisionAllowsSettlement() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();

        // Approve the workflow
        vm.expectEmit(true, false, false, true);
        emit DecisionRecorded(workflowId, true, "Approved for testing");

        workflow.recordDecision(workflowId, true, "Approved for testing");

        // State should be Approved
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Approved)
        );

        // Should now be able to execute payment
        workflow.executePayment{value: 0.5 ether}(workflowId, payable(bob));

        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Settled)
        );

        vm.stopPrank();
    }

    /// @notice Test: ETH balance changes correctly after settlement
    /// @dev Validates Phase 3: Settlement transfers ETH correctly
    function test_ETHBalanceChangesAfterSettlement() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, true, "Approved");

        uint256 paymentAmount = 2.5 ether;
        uint256 aliceBalanceBefore = alice.balance;
        uint256 bobBalanceBefore = bob.balance;

        workflow.executePayment{value: paymentAmount}(workflowId, payable(bob));

        // Verify alice paid
        assertEq(alice.balance, aliceBalanceBefore - paymentAmount);

        // Verify bob received
        assertEq(bob.balance, bobBalanceBefore + paymentAmount);

        vm.stopPrank();
    }

    /// @notice Test: Workflow completes successfully
    /// @dev Validates Phase 4: Finality
    function test_WorkflowCompletesSuccessfully() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, true, "Approved");
        workflow.executePayment{value: 1 ether}(workflowId, payable(bob));

        // Expect completion event
        vm.expectEmit(true, false, false, false);
        emit WorkflowCompleted(workflowId);

        workflow.completeWorkflow(workflowId);

        // Verify final state
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Completed)
        );

        vm.stopPrank();
    }

    // ============================================================================
    // FAILURE MODE TESTS
    // ============================================================================

    /// @notice Test: Rejected decision fails workflow
    /// @dev Validates Phase 2: Decision (rejection path)
    function test_RejectedDecisionFailsWorkflow() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();

        string memory rejectionReason = "Agent detected fraud";

        // Expect both DecisionRecorded and WorkflowFailed events
        vm.expectEmit(true, false, false, true);
        emit DecisionRecorded(workflowId, false, rejectionReason);

        vm.expectEmit(true, false, false, true);
        emit WorkflowFailed(workflowId, rejectionReason);

        workflow.recordDecision(workflowId, false, rejectionReason);

        // State should be Rejected
        assertEq(
            uint256(workflow.getWorkflowState(workflowId)),
            uint256(X402HelloWorld.WorkflowState.Rejected)
        );

        vm.stopPrank();
    }

    /// @notice Test: Payment cannot be executed after rejection
    /// @dev Validates that rejected workflows cannot proceed to settlement
    function test_CannotExecutePaymentAfterRejection() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, false, "Rejected");

        // Attempting to execute payment should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.WorkflowNotApproved.selector,
                workflowId,
                X402HelloWorld.WorkflowState.Rejected
            )
        );
        workflow.executePayment{value: 1 ether}(workflowId, payable(bob));

        vm.stopPrank();
    }

    /// @notice Test: Payment cannot be executed without ETH
    /// @dev Validates that settlement requires actual ETH transfer
    function test_CannotExecutePaymentWithoutETH() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, true, "Approved");

        // Attempting to pay 0 ETH should fail
        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.InsufficientPayment.selector,
                0,
                1
            )
        );
        workflow.executePayment{value: 0}(workflowId, payable(bob));

        vm.stopPrank();
    }

    /// @notice Test: Cannot make decision on non-existent workflow
    /// @dev Validates workflow existence checks
    function test_CannotDecideOnNonExistentWorkflow() public {
        bytes32 fakeWorkflowId = bytes32(uint256(12345));

        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.WorkflowNotFound.selector,
                fakeWorkflowId
            )
        );
        workflow.recordDecision(fakeWorkflowId, true, "Should fail");
    }

    /// @notice Test: Cannot execute payment on non-approved workflow
    /// @dev Validates that only approved workflows can be settled
    function test_CannotExecutePaymentOnActiveWorkflow() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();

        // Workflow is Active, not Approved
        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.WorkflowNotApproved.selector,
                workflowId,
                X402HelloWorld.WorkflowState.Active
            )
        );
        workflow.executePayment{value: 1 ether}(workflowId, payable(bob));

        vm.stopPrank();
    }

    /// @notice Test: Cannot complete workflow before settlement
    /// @dev Validates proper phase ordering
    function test_CannotCompleteBeforeSettlement() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, true, "Approved");

        // Workflow is Approved, not Settled
        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.WorkflowNotSettled.selector,
                workflowId,
                X402HelloWorld.WorkflowState.Approved
            )
        );
        workflow.completeWorkflow(workflowId);

        vm.stopPrank();
    }

    /// @notice Test: Cannot double-approve workflow
    /// @dev Validates state transition protection
    function test_CannotDoubleApproveWorkflow() public {
        vm.startPrank(alice);

        bytes32 workflowId = workflow.startWorkflow();
        workflow.recordDecision(workflowId, true, "First approval");

        // Workflow is now Approved, can't decide again
        vm.expectRevert(
            abi.encodeWithSelector(
                X402HelloWorld.WorkflowNotActive.selector,
                workflowId,
                X402HelloWorld.WorkflowState.Approved
            )
        );
        workflow.recordDecision(workflowId, true, "Second approval");

        vm.stopPrank();
    }

    /// @notice Test: Multiple workflows can run independently
    /// @dev Validates workflow isolation
    function test_MultipleWorkflowsIndependent() public {
        vm.startPrank(alice);

        // Create two independent workflows
        bytes32 workflow1 = workflow.startWorkflow();
        bytes32 workflow2 = workflow.startWorkflow();

        // Workflows should have different IDs
        assertTrue(workflow1 != workflow2);

        // Approve and settle first workflow
        workflow.recordDecision(workflow1, true, "Approve 1");
        workflow.executePayment{value: 1 ether}(workflow1, payable(bob));

        // Second workflow should still be Active
        assertEq(
            uint256(workflow.getWorkflowState(workflow2)),
            uint256(X402HelloWorld.WorkflowState.Active)
        );

        // Reject second workflow
        workflow.recordDecision(workflow2, false, "Reject 2");

        // First workflow should still be Settled
        assertEq(
            uint256(workflow.getWorkflowState(workflow1)),
            uint256(X402HelloWorld.WorkflowState.Settled)
        );

        // Second workflow should be Rejected
        assertEq(
            uint256(workflow.getWorkflowState(workflow2)),
            uint256(X402HelloWorld.WorkflowState.Rejected)
        );

        vm.stopPrank();
    }
}
