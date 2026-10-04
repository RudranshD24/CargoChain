// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CargoChainTypes.sol";
import "./ParticipantRegistry.sol";
import "./ShipmentRegistry.sol";
import "./EscrowManager.sol";

/// @title DisputeManager — Handles shipment disputes and resolution
/// @notice Implements FR-DSP-01 and coordinates with EscrowManager for FR-ESC-05.
///         Shipper or Receiver can raise a dispute on active shipments.
///         Admin resolves disputes with terminal outcomes.
contract DisputeManager {
    // ──────────── State ────────────

    ParticipantRegistry public immutable registry;
    ShipmentRegistry public immutable shipmentRegistry;
    EscrowManager public immutable escrowManager;

    mapping(uint256 => Dispute) private _disputes;
    uint256[] private _disputeIds;

    // ──────────── Events ────────────

    event DisputeRaised(
        uint256 indexed shipmentId,
        address indexed raisedBy,
        DisputeReason reason,
        string notes
    );

    event DisputeResolved(
        uint256 indexed shipmentId,
        address indexed resolvedBy,
        Resolution resolution,
        string adminNotes
    );

    // ──────────── Constructor ────────────

    constructor(
        address _registry,
        address _shipmentRegistry,
        address _escrowManager
    ) {
        if (
            _registry == address(0) ||
            _shipmentRegistry == address(0) ||
            _escrowManager == address(0)
        ) {
            revert InvalidAddress();
        }
        registry = ParticipantRegistry(_registry);
        shipmentRegistry = ShipmentRegistry(_shipmentRegistry);
        escrowManager = EscrowManager(_escrowManager);
    }

    // ──────────── Modifiers ────────────

    modifier onlyActive() {
        registry.requireActiveParticipant(msg.sender);
        _;
    }

    modifier onlyAdmin() {
        registry.requireRole(msg.sender, Role.Admin);
        _;
    }

    // ──────────── External Functions ────────────

    /// @notice Raise a dispute for an active shipment.
    ///         Callable by assigned Shipper or Receiver only.
    ///         Eligible statuses: InTransit, Delayed, Arrived, Delivered.
    ///         Freezes escrow if deposited.
    function raiseDispute(
        uint256 shipmentId,
        DisputeReason reason,
        string calldata notes
    ) external onlyActive {
        Shipment memory s = shipmentRegistry.getShipment(shipmentId);

        // Caller must be shipper or receiver
        if (msg.sender != s.shipper && msg.sender != s.receiver) {
            revert NotAssigned(msg.sender, shipmentId);
        }

        // Cannot raise if already disputed
        if (_disputes[shipmentId].raisedAt != 0) {
            revert DisputeAlreadyOpen(shipmentId);
        }

        // Check eligible status
        if (
            s.status != Status.InTransit &&
            s.status != Status.Delayed &&
            s.status != Status.Arrived &&
            s.status != Status.Delivered
        ) {
            revert DisputeNotAllowed(shipmentId, s.status);
        }

        // Record dispute
        _disputes[shipmentId] = Dispute({
            shipmentId: shipmentId,
            reason: reason,
            notes: notes,
            raisedBy: msg.sender,
            resolved: false,
            resolution: Resolution.ReleaseToTransporter, // placeholder until resolved
            adminNotes: "",
            resolvedBy: address(0),
            raisedAt: block.timestamp,
            resolvedAt: 0
        });
        _disputeIds.push(shipmentId);

        // Transition status on ShipmentRegistry
        shipmentRegistry.setDisputed(shipmentId);

        // Freeze escrow if deposited
        if (escrowManager.isDeposited(shipmentId)) {
            escrowManager.freeze(shipmentId);
        }

        emit DisputeRaised(shipmentId, msg.sender, reason, notes);
    }

    /// @notice Admin resolves an open dispute.
    /// @param shipmentId The disputed shipment.
    /// @param resolution Resolution outcome (ReleaseToTransporter, RefundToShipper, Split).
    /// @param splitShipperBps Basis points to shipper if resolution is Split (0..10000).
    /// @param adminNotes Justification notes from the admin.
    function resolveDispute(
        uint256 shipmentId,
        Resolution resolution,
        uint256 splitShipperBps,
        string calldata adminNotes
    ) external onlyAdmin {
        Dispute storage d = _disputes[shipmentId];
        if (d.raisedAt == 0) revert DisputeNotOpen(shipmentId);
        if (d.resolved) revert DisputeAlreadyOpen(shipmentId);

        d.resolved = true;
        d.resolution = resolution;
        d.adminNotes = adminNotes;
        d.resolvedBy = msg.sender;
        d.resolvedAt = block.timestamp;

        // Transition shipment status
        if (
            resolution == Resolution.ReleaseToTransporter ||
            resolution == Resolution.Split
        ) {
            shipmentRegistry.setResolved(shipmentId, Status.Completed);
        } else if (resolution == Resolution.RefundToShipper) {
            shipmentRegistry.setResolved(shipmentId, Status.Cancelled);
        }

        // Settle escrow payout
        escrowManager.resolveDisputePayout(shipmentId, resolution, splitShipperBps);

        emit DisputeResolved(shipmentId, msg.sender, resolution, adminNotes);
    }

    // ──────────── View Functions ────────────

    /// @notice Returns full dispute record for a shipment.
    function getDispute(uint256 shipmentId)
        external
        view
        returns (Dispute memory)
    {
        if (_disputes[shipmentId].raisedAt == 0) {
            revert DisputeNotOpen(shipmentId);
        }
        return _disputes[shipmentId];
    }

    /// @notice Check if a shipment has a dispute.
    function hasDispute(uint256 shipmentId) external view returns (bool) {
        return _disputes[shipmentId].raisedAt != 0;
    }

    /// @notice Returns total number of disputes raised.
    function disputeCount() external view returns (uint256) {
        return _disputeIds.length;
    }

    /// @notice Paginated access to disputed shipment IDs.
    function getDisputeIds(uint256 offset, uint256 limit)
        external
        view
        returns (uint256[] memory result)
    {
        if (offset >= _disputeIds.length) return new uint256[](0);

        uint256 end = offset + limit;
        if (end > _disputeIds.length) end = _disputeIds.length;
        uint256 count = end - offset;

        result = new uint256[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = _disputeIds[offset + i];
        }
    }
}
