// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CargoChainTypes.sol";
import "./ParticipantRegistry.sol";

/// @title ShipmentRegistry — Sole owner of shipment status
/// @notice Implements FR-SHP-01..05. Enforces the canonical transition matrix.
///         Only this contract may change shipment status.
/// @dev    Manager contracts (TrackingManager) call narrowly scoped entry points
///         for transitions they are authorized to perform.
contract ShipmentRegistry {
    // ──────────── State ────────────

    ParticipantRegistry public immutable registry;

    mapping(uint256 => Shipment) private _shipments;
    mapping(bytes32 => bool) private _usedRefs;
    uint256 private _nextId = 1;

    address public trackingManager;
    address public escrowManager;
    address public disputeManager;
    address private _deployer;

    // ──────────── Events ────────────

    event ShipmentCreated(
        uint256 indexed shipmentId,
        bytes32 indexed externalRef,
        address indexed shipper,
        address transporter,
        address receiver,
        uint256 paymentAmount
    );

    event ShipmentAccepted(uint256 indexed shipmentId, address indexed transporter);
    event ShipmentRejected(uint256 indexed shipmentId, address indexed transporter);
    event ShipmentCancelled(uint256 indexed shipmentId, address indexed shipper);

    event StatusChanged(
        uint256 indexed shipmentId,
        Status indexed from,
        Status indexed to,
        address changedBy
    );

    event DeliveryConfirmed(
        uint256 indexed shipmentId,
        address indexed receiver,
        Condition condition
    );

    event DeliveryAccepted(uint256 indexed shipmentId, address indexed receiver);

    // ──────────── Constructor ────────────

    constructor(address _registry) {
        if (_registry == address(0)) revert InvalidAddress();
        registry = ParticipantRegistry(_registry);
        _deployer = msg.sender;
    }

    // ──────────── Modifiers ────────────

    modifier onlyRole(Role role) {
        registry.requireRole(msg.sender, role);
        _;
    }

    modifier onlyActive() {
        registry.requireActiveParticipant(msg.sender);
        _;
    }

    modifier shipmentExists(uint256 id) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        _;
    }

    modifier onlyTrackingManager() {
        if (msg.sender != trackingManager) revert OnlyManager(msg.sender);
        _;
    }

    modifier onlyDisputeManager() {
        if (msg.sender != disputeManager) revert OnlyManager(msg.sender);
        _;
    }

    // ──────────── Admin Setup ────────────

    /// @notice Set the TrackingManager contract address. Deployer only, once.
    function setTrackingManager(address _tm) external {
        if (msg.sender != _deployer) revert Unauthorized(msg.sender, Role.Admin);
        if (_tm == address(0)) revert InvalidAddress();
        trackingManager = _tm;
    }

    /// @notice Set the EscrowManager contract address. Deployer only, once.
    function setEscrowManager(address _em) external {
        if (msg.sender != _deployer) revert Unauthorized(msg.sender, Role.Admin);
        if (_em == address(0)) revert InvalidAddress();
        escrowManager = _em;
    }

    /// @notice Set the DisputeManager contract address. Deployer only, once.
    function setDisputeManager(address _dm) external {
        if (msg.sender != _deployer) revert Unauthorized(msg.sender, Role.Admin);
        if (_dm == address(0)) revert InvalidAddress();
        disputeManager = _dm;
    }

    // ──────────── Shipper Functions ────────────

    /// @notice Create a new shipment with a unique external reference.
    /// @param input Shipment parameters (see ShipmentInput struct).
    /// @return shipmentId The assigned shipment ID (starts at 1).
    function createShipment(ShipmentInput calldata input)
        external
        onlyRole(Role.Shipper)
        returns (uint256 shipmentId)
    {
        // Validate unique reference
        if (_usedRefs[input.externalRef]) revert DuplicateExternalRef(input.externalRef);
        if (input.externalRef == bytes32(0)) revert DuplicateExternalRef(input.externalRef);

        // Validate participants
        if (input.transporter == address(0) || input.receiver == address(0)) {
            revert InvalidAddress();
        }
        if (input.quantity == 0) revert InvalidQuantity();
        if (input.expectedDelivery == 0) revert InvalidDeliveryTime();

        // Check assigned participants are active with correct roles
        registry.requireRole(input.transporter, Role.Transporter);
        registry.requireRole(input.receiver, Role.Receiver);
        if (input.warehouse != address(0)) {
            registry.requireRole(input.warehouse, Role.Warehouse);
        }
        if (input.inspector != address(0)) {
            registry.requireRole(input.inspector, Role.Inspector);
        }

        shipmentId = _nextId++;
        _usedRefs[input.externalRef] = true;

        Shipment storage s = _shipments[shipmentId];
        s.id = shipmentId;
        s.externalRef = input.externalRef;
        s.productDescription = input.productDescription;
        s.quantity = input.quantity;
        s.origin = input.origin;
        s.destination = input.destination;
        s.destLat = input.destLat;
        s.destLon = input.destLon;
        s.geofenceRadiusM = input.geofenceRadiusM;
        s.shipper = msg.sender;
        s.transporter = input.transporter;
        s.receiver = input.receiver;
        s.warehouse = input.warehouse;
        s.inspector = input.inspector;
        s.currentCustodian = msg.sender;  // Shipper has initial custody
        s.status = Status.Created;
        s.expectedDelivery = input.expectedDelivery;
        s.paymentAmount = input.paymentAmount;
        s.createdAt = block.timestamp;

        emit ShipmentCreated(
            shipmentId,
            input.externalRef,
            msg.sender,
            input.transporter,
            input.receiver,
            input.paymentAmount
        );
    }

    /// @notice Shipper cancels an eligible shipment (Created only).
    function cancelShipment(uint256 id) external shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (msg.sender != s.shipper) revert NotAssigned(msg.sender, id);
        if (s.status != Status.Created) {
            revert InvalidTransition(s.status, Status.Cancelled);
        }

        Status from = s.status;
        s.status = Status.Cancelled;

        emit ShipmentCancelled(id, msg.sender);
        emit StatusChanged(id, from, Status.Cancelled, msg.sender);
    }

    // ──────────── Transporter Functions ────────────

    /// @notice Assigned transporter accepts the shipment.
    function acceptShipment(uint256 id) external shipmentExists(id) onlyActive {
        Shipment storage s = _shipments[id];
        if (msg.sender != s.transporter) revert NotAssigned(msg.sender, id);
        if (s.status != Status.Created) {
            revert InvalidTransition(s.status, Status.Accepted);
        }

        Status from = s.status;
        s.status = Status.Accepted;

        emit ShipmentAccepted(id, msg.sender);
        emit StatusChanged(id, from, Status.Accepted, msg.sender);
    }

    /// @notice Assigned transporter rejects the shipment.
    function rejectShipment(uint256 id) external shipmentExists(id) onlyActive {
        Shipment storage s = _shipments[id];
        if (msg.sender != s.transporter) revert NotAssigned(msg.sender, id);
        if (s.status != Status.Created) {
            revert InvalidTransition(s.status, Status.Rejected);
        }

        Status from = s.status;
        s.status = Status.Rejected;

        emit ShipmentRejected(id, msg.sender);
        emit StatusChanged(id, from, Status.Rejected, msg.sender);
    }

    // ──────────── Receiver Functions ────────────

    /// @notice Receiver confirms delivery and records condition (Arrived → Delivered).
    function confirmDelivery(uint256 id, Condition condition)
        external
        shipmentExists(id)
        onlyActive
    {
        Shipment storage s = _shipments[id];
        if (msg.sender != s.receiver) revert NotAssigned(msg.sender, id);
        if (s.status != Status.Arrived) {
            revert InvalidTransition(s.status, Status.Delivered);
        }

        Status from = s.status;
        s.status = Status.Delivered;
        s.deliveryCondition = condition;
        s.deliveredAt = uint64(block.timestamp);

        emit DeliveryConfirmed(id, msg.sender, condition);
        emit StatusChanged(id, from, Status.Delivered, msg.sender);
    }

    /// @notice Receiver accepts delivery (Delivered → Completed). Escrow becomes eligible.
    function acceptDelivery(uint256 id) external shipmentExists(id) onlyActive {
        Shipment storage s = _shipments[id];
        if (msg.sender != s.receiver) revert NotAssigned(msg.sender, id);
        if (s.status != Status.Delivered) {
            revert InvalidTransition(s.status, Status.Completed);
        }

        Status from = s.status;
        s.status = Status.Completed;

        emit DeliveryAccepted(id, msg.sender);
        emit StatusChanged(id, from, Status.Completed, msg.sender);

        // Mark escrow eligible if funded
        if (s.paymentAmount > 0 && escrowManager != address(0)) {
            IEscrowCallback(escrowManager).markEligible(id);
        }
    }

    // ──────────── Manager Entry Points (TrackingManager only) ────────────

    /// @notice TrackingManager sets status to InTransit (from Accepted).
    /// @dev    Validates escrow is funded when paymentAmount > 0.
    function setInTransit(uint256 id) external onlyTrackingManager shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (s.status != Status.Accepted) {
            revert InvalidTransition(s.status, Status.InTransit);
        }
        // Check escrow if payment is configured
        if (s.paymentAmount > 0 && escrowManager != address(0)) {
            if (!IEscrowCallback(escrowManager).isDeposited(id)) {
                revert EscrowRequired(id);
            }
        }

        Status from = s.status;
        s.status = Status.InTransit;
        emit StatusChanged(id, from, Status.InTransit, msg.sender);
    }

    /// @notice TrackingManager marks shipment as delayed (from InTransit).
    function setDelayed(uint256 id) external onlyTrackingManager shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (s.status != Status.InTransit) {
            revert InvalidTransition(s.status, Status.Delayed);
        }

        Status from = s.status;
        s.status = Status.Delayed;
        emit StatusChanged(id, from, Status.Delayed, msg.sender);
    }

    /// @notice TrackingManager resumes transit (from Delayed back to InTransit).
    function resumeTransit(uint256 id) external onlyTrackingManager shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (s.status != Status.Delayed) {
            revert InvalidTransition(s.status, Status.InTransit);
        }

        Status from = s.status;
        s.status = Status.InTransit;
        emit StatusChanged(id, from, Status.InTransit, msg.sender);
    }

    /// @notice TrackingManager marks shipment as arrived (from InTransit or Delayed).
    function setArrived(uint256 id) external onlyTrackingManager shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (s.status != Status.InTransit && s.status != Status.Delayed) {
            revert InvalidTransition(s.status, Status.Arrived);
        }

        Status from = s.status;
        s.status = Status.Arrived;
        emit StatusChanged(id, from, Status.Arrived, msg.sender);
    }

    /// @notice TrackingManager updates the current custodian.
    function updateCustodian(uint256 id, address newCustodian)
        external
        onlyTrackingManager
        shipmentExists(id)
    {
        _shipments[id].currentCustodian = newCustodian;
    }

    // ──────────── DisputeManager Entry Points ────────────

    /// @notice DisputeManager sets status to Disputed (from InTransit, Delayed, Arrived, Delivered).
    function setDisputed(uint256 id) external onlyDisputeManager shipmentExists(id) {
        Shipment storage s = _shipments[id];
        if (
            s.status != Status.InTransit &&
            s.status != Status.Delayed &&
            s.status != Status.Arrived &&
            s.status != Status.Delivered
        ) {
            revert InvalidTransition(s.status, Status.Disputed);
        }

        Status from = s.status;
        s.status = Status.Disputed;
        emit StatusChanged(id, from, Status.Disputed, msg.sender);
    }

    /// @notice DisputeManager resolves dispute (Disputed → Completed or Cancelled).
    function setResolved(uint256 id, Status newStatus)
        external
        onlyDisputeManager
        shipmentExists(id)
    {
        Shipment storage s = _shipments[id];
        if (s.status != Status.Disputed) {
            revert InvalidTransition(s.status, newStatus);
        }
        if (newStatus != Status.Completed && newStatus != Status.Cancelled) {
            revert InvalidTransition(s.status, newStatus);
        }

        Status from = s.status;
        s.status = newStatus;
        emit StatusChanged(id, from, newStatus, msg.sender);
    }

    // ──────────── View Functions ────────────

    /// @notice Returns the full shipment record.
    function getShipment(uint256 id) external view returns (Shipment memory) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        return _shipments[id];
    }

    /// @notice Returns just the current status of a shipment.
    function statusOf(uint256 id) external view returns (Status) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        return _shipments[id].status;
    }

    /// @notice Returns the next shipment ID (i.e., total created + 1).
    function nextShipmentId() external view returns (uint256) {
        return _nextId;
    }

    /// @notice Returns the shipper address for a shipment.
    function shipperOf(uint256 id) external view returns (address) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        return _shipments[id].shipper;
    }

    /// @notice Returns the transporter address for a shipment.
    function transporterOf(uint256 id) external view returns (address) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        return _shipments[id].transporter;
    }

    /// @notice Returns the payment amount for a shipment.
    function paymentAmountOf(uint256 id) external view returns (uint256) {
        if (_shipments[id].id == 0) revert ShipmentNotFound(id);
        return _shipments[id].paymentAmount;
    }
}

// ──────────── Callback Interface ────────────

/// @dev Minimal interface for ShipmentRegistry to call EscrowManager.
interface IEscrowCallback {
    function markEligible(uint256 shipmentId) external;
    function isDeposited(uint256 shipmentId) external view returns (bool);
}
