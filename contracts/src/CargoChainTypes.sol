// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @title CargoChainTypes — Shared enums, structs and errors for CargoChain
/// @notice Canonical types per PROJECT_MASTER.md §5–§6 and ARCHITECTURE.md §4

// ──────────── Enums ────────────

/// @notice Canonical participant roles. Enum order is authoritative.
enum Role {
    None,
    Admin,
    Shipper,
    Transporter,
    Warehouse,
    Inspector,
    Receiver,
    Oracle
}

/// @notice Canonical shipment statuses. Terminal: Completed, Rejected, Cancelled.
enum Status {
    Created,
    Accepted,
    InTransit,
    Delayed,
    Arrived,
    Delivered,
    Completed,
    Rejected,
    Disputed,
    Cancelled
}

/// @notice Milestone types for shipment tracking events.
enum MilestoneType {
    Dispatched,
    InTransit,
    WarehouseArrival,
    Arrived,
    Delivered
}

/// @notice Document types for anchored metadata.
enum DocType {
    Invoice,
    BillOfLading,
    PackingList,
    InspectionCertificate,
    Other
}

/// @notice Delivery condition recorded by the Receiver.
enum Condition {
    Intact,
    Damaged,
    Partial
}

/// @notice Dispute reasons (advanced scope).
enum DisputeReason {
    Damaged,
    Missing,
    Delayed,
    Other
}

/// @notice Dispute resolution outcomes (advanced scope).
enum Resolution {
    ReleaseToTransporter,
    RefundToShipper,
    Split
}

// ──────────── Structs ────────────

/// @notice Input parameters for creating a shipment.
struct ShipmentInput {
    bytes32 externalRef;
    string productDescription;
    uint32 quantity;
    string origin;
    string destination;
    int32 destLat;
    int32 destLon;
    uint32 geofenceRadiusM;
    address transporter;
    address receiver;
    address warehouse;       // address(0) if not assigned
    address inspector;       // address(0) if not assigned
    uint64 expectedDelivery;
    uint256 paymentAmount;   // wei; 0 means no escrow required
}

/// @notice On-chain shipment record.
struct Shipment {
    uint256 id;
    bytes32 externalRef;
    string productDescription;
    uint32 quantity;
    string origin;
    string destination;
    int32 destLat;
    int32 destLon;
    uint32 geofenceRadiusM;
    address shipper;
    address transporter;
    address receiver;
    address warehouse;
    address inspector;
    address currentCustodian;
    Status status;
    Condition deliveryCondition;
    uint64 expectedDelivery;
    uint64 deliveredAt;
    uint256 paymentAmount;
    uint256 createdAt;
}

/// @notice On-chain milestone record.
struct Milestone {
    MilestoneType milestoneType;
    string location;
    int32 lat;
    int32 lon;
    string note;
    address submitter;
    Role submitterRole;
    uint256 blockTime;
}

/// @notice On-chain document anchor record.
struct Document {
    uint256 shipmentId;
    uint256 docIndex;
    DocType docType;
    bytes32 contentHash;    // SHA-256 of raw file bytes
    string cid;             // IPFS content identifier
    address uploader;
    uint256 blockTime;
}

/// @notice On-chain dispute record.
struct Dispute {
    uint256 shipmentId;
    DisputeReason reason;
    string notes;
    address raisedBy;
    bool resolved;
    Resolution resolution;
    string adminNotes;
    address resolvedBy;
    uint256 raisedAt;
    uint256 resolvedAt;
}

// ──────────── Custom Errors ────────────

error Unauthorized(address caller, Role required);
error InactiveParticipant(address participant);
error AlreadyRegistered(address participant);
error NotRegistered(address participant);
error InvalidAddress();
error ShipmentNotFound(uint256 shipmentId);
error DuplicateExternalRef(bytes32 ref);
error InvalidTransition(Status from, Status to);
error NotAssigned(address caller, uint256 shipmentId);
error NotCustodian(address caller, uint256 shipmentId);
error OnlyManager(address caller);
error IncorrectAmount(uint256 expected, uint256 actual);
error AlreadyDeposited(uint256 shipmentId);
error NotDeposited(uint256 shipmentId);
error AlreadyReleased(uint256 shipmentId);
error AlreadyRefunded(uint256 shipmentId);
error NotEligible(uint256 shipmentId);
error EscrowRequired(uint256 shipmentId);
error TransferFailed();
error InvalidQuantity();
error InvalidDeliveryTime();
error HashAlreadyRegistered(bytes32 hash);
error InvalidDocIndex(uint256 shipmentId, uint256 docIndex);
error OutsideGeofence(uint256 shipmentId, int32 lat, int32 lon);
error DisputeAlreadyOpen(uint256 shipmentId);
error DisputeNotOpen(uint256 shipmentId);
error EscrowIsFrozen(uint256 shipmentId);
error DisputeNotAllowed(uint256 shipmentId, Status status);
error InvalidResolution();
