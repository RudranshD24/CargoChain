// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CargoChainTypes.sol";
import "./ParticipantRegistry.sol";
import "./ShipmentRegistry.sol";

/// @title TrackingManager — Milestones, custody and status transitions
/// @notice Implements FR-TRK-01 (milestones), FR-TRK-02 (custody), FR-TRK-03 (warehouse).
///         Calls ShipmentRegistry manager entry points for status changes.
contract TrackingManager {
    // ──────────── State ────────────

    ParticipantRegistry public immutable registry;
    ShipmentRegistry public immutable shipmentRegistry;

    /// @dev shipmentId => ordered milestones
    mapping(uint256 => Milestone[]) private _milestones;

    // ──────────── Events ────────────

    /// @notice Emitted when a milestone is recorded.
    event MilestoneRecorded(
        uint256 indexed shipmentId,
        MilestoneType indexed milestoneType,
        string location,
        address indexed submitter,
        Role submitterRole
    );

    /// @notice Emitted when custody is transferred.
    event CustodyTransferred(
        uint256 indexed shipmentId,
        address indexed from,
        address indexed to
    );

    /// @notice Emitted when an oracle waypoint update is recorded.
    event OracleUpdateRecorded(
        uint256 indexed shipmentId,
        address indexed reporter,
        int32 lat,
        int32 lon,
        MilestoneType milestoneType,
        bool inGeofence,
        string metadataURI,
        uint256 timestamp
    );

    // ──────────── Constructor ────────────

    constructor(address _registry, address _shipmentRegistry) {
        if (_registry == address(0) || _shipmentRegistry == address(0)) {
            revert InvalidAddress();
        }
        registry = ParticipantRegistry(_registry);
        shipmentRegistry = ShipmentRegistry(_shipmentRegistry);
    }

    // ──────────── Modifiers ────────────

    modifier onlyActive() {
        registry.requireActiveParticipant(msg.sender);
        _;
    }

    // ──────────── External Functions ────────────

    /// @notice Transporter dispatches shipment (Accepted → InTransit).
    ///         Records a Dispatched milestone and transfers custody to transporter.
    /// @param id       Shipment ID.
    /// @param location Dispatch location name.
    function startTransit(uint256 id, string calldata location) external onlyActive {
        Shipment memory s = shipmentRegistry.getShipment(id);
        if (msg.sender != s.transporter) revert NotAssigned(msg.sender, id);

        // Record milestone
        _recordMilestone(id, MilestoneType.Dispatched, location, 0, 0, "");

        // Update status via ShipmentRegistry
        shipmentRegistry.setInTransit(id);

        // Transfer custody to transporter
        shipmentRegistry.updateCustodian(id, msg.sender);
        emit CustodyTransferred(id, s.currentCustodian, msg.sender);
    }

    /// @notice Record a manual milestone. Authorized participants only.
    /// @dev    Does not change shipment status by itself.
    function recordMilestone(
        uint256 id,
        MilestoneType milestoneType,
        string calldata location,
        int32 lat,
        int32 lon,
        string calldata note
    ) external onlyActive {
        Shipment memory s = shipmentRegistry.getShipment(id);
        _requireInvolvedParty(s, msg.sender);

        _recordMilestone(id, milestoneType, location, lat, lon, note);
    }

    /// @notice Confirm warehouse arrival (InTransit/Delayed → Arrived).
    ///         Only Transporter or assigned Warehouse.
    function confirmWarehouseArrival(uint256 id, string calldata location)
        external
        onlyActive
    {
        Shipment memory s = shipmentRegistry.getShipment(id);

        // Check authorization: transporter or assigned warehouse
        bool isTransporter = (msg.sender == s.transporter);
        bool isWarehouse = (s.warehouse != address(0) && msg.sender == s.warehouse);
        if (!isTransporter && !isWarehouse) revert NotAssigned(msg.sender, id);

        // Record milestone
        _recordMilestone(id, MilestoneType.WarehouseArrival, location, 0, 0, "");

        // Update status via ShipmentRegistry
        shipmentRegistry.setArrived(id);

        // If warehouse is assigned, transfer custody
        if (isWarehouse) {
            address prevCustodian = s.currentCustodian;
            shipmentRegistry.updateCustodian(id, msg.sender);
            emit CustodyTransferred(id, prevCustodian, msg.sender);
        }
    }

    /// @notice Transfer custody to another active participant.
    ///         Only the current custodian may transfer.
    function transferCustody(uint256 id, address to) external onlyActive {
        if (to == address(0)) revert InvalidAddress();
        registry.requireActiveParticipant(to);

        Shipment memory s = shipmentRegistry.getShipment(id);
        if (msg.sender != s.currentCustodian) revert NotCustodian(msg.sender, id);

        shipmentRegistry.updateCustodian(id, to);
        emit CustodyTransferred(id, msg.sender, to);
    }

    /// @notice Mark shipment as delayed (InTransit → Delayed).
    ///         Transporter, Admin, or Oracle only.
    function markDelayed(uint256 id) external onlyActive {
        Shipment memory s = shipmentRegistry.getShipment(id);

        Role callerRole = registry.roleOf(msg.sender);
        bool isTransporter = (msg.sender == s.transporter);
        bool isAdmin = (callerRole == Role.Admin);
        bool isOracle = (callerRole == Role.Oracle);
        if (!isTransporter && !isAdmin && !isOracle) revert NotAssigned(msg.sender, id);

        shipmentRegistry.setDelayed(id);
    }

    /// @notice Resume transit after delay (Delayed → InTransit).
    ///         Transporter only.
    function resumeTransit(uint256 id) external onlyActive {
        Shipment memory s = shipmentRegistry.getShipment(id);
        if (msg.sender != s.transporter) revert NotAssigned(msg.sender, id);

        shipmentRegistry.resumeTransit(id);
    }

    /// @notice Restricted Oracle service submits simulated route / waypoint update.
    /// @dev    Enforces Role.Oracle. Applies geofence check against destination when milestone is Arrived.
    function submitOracleUpdate(
        uint256 id,
        int32 lat,
        int32 lon,
        MilestoneType milestoneType,
        string calldata metadataURI
    ) external onlyActive {
        registry.requireRole(msg.sender, Role.Oracle);
        Shipment memory s = shipmentRegistry.getShipment(id);

        // Shipment must be InTransit or Delayed
        if (s.status != Status.InTransit && s.status != Status.Delayed) {
            revert InvalidTransition(s.status, Status.InTransit);
        }

        // Geofence check against shipment destination
        bool inGeofence = checkGeofence(lat, lon, s.destLat, s.destLon, s.geofenceRadiusM);

        if (milestoneType == MilestoneType.Arrived) {
            if (!inGeofence) {
                revert OutsideGeofence(id, lat, lon);
            }
            shipmentRegistry.setArrived(id);
        }

        _recordMilestone(id, milestoneType, "Oracle Waypoint", lat, lon, metadataURI);

        emit OracleUpdateRecorded(
            id,
            msg.sender,
            lat,
            lon,
            milestoneType,
            inGeofence,
            metadataURI,
            block.timestamp
        );
    }

    /// @notice Pure helper to check if (lat, lon) is within radius of (destLat, destLon) in microdegrees.
    ///         1 degree ≈ 111,111 meters; 1 meter ≈ 9 microdegrees.
    function checkGeofence(
        int32 lat,
        int32 lon,
        int32 destLat,
        int32 destLon,
        uint32 geofenceRadiusM
    ) public pure returns (bool) {
        if (geofenceRadiusM == 0) {
            return true;
        }
        int64 dLat = int64(lat) - int64(destLat);
        int64 dLon = int64(lon) - int64(destLon);
        uint64 allowedRadiusMicro = uint64(geofenceRadiusM) * 9;
        uint64 distSq = uint64(dLat * dLat + dLon * dLon);
        return distSq <= (allowedRadiusMicro * allowedRadiusMicro);
    }

    // ──────────── View Functions ────────────

    /// @notice Get milestones for a shipment (bounded by offset/limit).
    function getMilestones(uint256 id, uint256 offset, uint256 limit)
        external
        view
        returns (Milestone[] memory result)
    {
        Milestone[] storage all = _milestones[id];
        if (offset >= all.length) return new Milestone[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        uint256 count = end - offset;

        result = new Milestone[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = all[offset + i];
        }
    }

    /// @notice Returns total milestone count for a shipment.
    function milestoneCount(uint256 id) external view returns (uint256) {
        return _milestones[id].length;
    }

    // ──────────── Internal ────────────

    function _recordMilestone(
        uint256 id,
        MilestoneType mt,
        string memory location,
        int32 lat,
        int32 lon,
        string memory note
    ) internal {
        Role callerRole = registry.roleOf(msg.sender);
        _milestones[id].push(Milestone({
            milestoneType: mt,
            location: location,
            lat: lat,
            lon: lon,
            note: note,
            submitter: msg.sender,
            submitterRole: callerRole,
            blockTime: block.timestamp
        }));

        emit MilestoneRecorded(id, mt, location, msg.sender, callerRole);
    }

    function _requireInvolvedParty(Shipment memory s, address caller) internal pure {
        if (
            caller != s.shipper &&
            caller != s.transporter &&
            caller != s.receiver &&
            caller != s.warehouse &&
            caller != s.inspector
        ) {
            revert NotAssigned(caller, s.id);
        }
    }
}
