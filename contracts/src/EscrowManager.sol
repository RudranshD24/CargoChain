// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./CargoChainTypes.sol";
import "./ParticipantRegistry.sol";
import "./ShipmentRegistry.sol";

/// @title EscrowManager — Test-ETH escrow for simulated freight payment
/// @notice Implements FR-ESC-01 (deposit), FR-ESC-02 (eligibility),
///         FR-ESC-03 (release once), FR-ESC-04 (refund on reject/cancel),
///         FR-ESC-05 (freeze during dispute), FR-ESC-06 (capped late penalty),
///         FR-ESC-07 (configurable escrow rules).
///         Escrow uses Ganache test ETH only — not real payment (DEC-009).
/// @dev    Uses OpenZeppelin ReentrancyGuard. Pull-style payments.
///         Checks-effects-interactions pattern on all ETH transfers.
contract EscrowManager is ReentrancyGuard {
    // ──────────── State ────────────

    ParticipantRegistry public immutable registry;
    ShipmentRegistry public immutable shipmentRegistry;

    struct EscrowState {
        bool deposited;
        bool eligible;
        bool released;
        bool refunded;
        bool frozen;
        uint256 amount;
    }

    mapping(uint256 => EscrowState) private _escrows;

    uint256 public latePenaltyBpsPerDay = 200; // 200 bps = 2% per day late
    uint256 public maxPenaltyBps = 3000;       // 3000 bps = 30% max penalty
    address public disputeManager;
    address private _deployer;

    // ──────────── Events ────────────

    /// @notice Emitted when test-ETH escrow is funded.
    event EscrowFunded(
        uint256 indexed shipmentId,
        address indexed depositor,
        uint256 amount
    );

    /// @notice Emitted when escrow becomes eligible for release.
    event PaymentEligible(uint256 indexed shipmentId);

    /// @notice Emitted when test-ETH payment is released to transporter.
    event PaymentReleased(
        uint256 indexed shipmentId,
        address indexed recipient,
        uint256 amount
    );

    /// @notice Emitted when test-ETH is refunded to shipper.
    event EscrowRefunded(
        uint256 indexed shipmentId,
        address indexed recipient,
        uint256 amount
    );

    /// @notice Emitted when escrow is frozen during a dispute.
    event EscrowFrozen(uint256 indexed shipmentId);

    /// @notice Emitted when escrow is unfrozen.
    event EscrowUnfrozen(uint256 indexed shipmentId);

    /// @notice Emitted when a late delivery penalty is deducted and refunded to shipper.
    event PenaltyApplied(uint256 indexed shipmentId, uint256 penaltyAmount, uint256 daysLate);

    /// @notice Emitted when admin updates escrow penalty rules.
    event RuleChanged(uint256 latePenaltyBpsPerDay, uint256 maxPenaltyBps);

    // ──────────── Constructor ────────────

    constructor(address _registry, address _shipmentRegistry) {
        if (_registry == address(0) || _shipmentRegistry == address(0)) {
            revert InvalidAddress();
        }
        registry = ParticipantRegistry(_registry);
        shipmentRegistry = ShipmentRegistry(_shipmentRegistry);
        _deployer = msg.sender;
    }

    // ──────────── Admin / Configuration ────────────

    /// @notice Set the DisputeManager contract address. Deployer only.
    function setDisputeManager(address _dm) external {
        if (msg.sender != _deployer) revert Unauthorized(msg.sender, Role.Admin);
        if (_dm == address(0)) revert InvalidAddress();
        disputeManager = _dm;
    }

    /// @notice Admin configures late penalty parameters.
    function setRules(uint256 _latePenaltyBpsPerDay, uint256 _maxPenaltyBps) external {
        registry.requireRole(msg.sender, Role.Admin);
        if (_maxPenaltyBps > 10000) revert IncorrectAmount(10000, _maxPenaltyBps);
        latePenaltyBpsPerDay = _latePenaltyBpsPerDay;
        maxPenaltyBps = _maxPenaltyBps;
        emit RuleChanged(_latePenaltyBpsPerDay, _maxPenaltyBps);
    }

    // ──────────── Freeze / Unfreeze ────────────

    /// @notice Freeze escrow during dispute. DisputeManager or Admin only.
    function freeze(uint256 shipmentId) external {
        bool isDm = (msg.sender == disputeManager);
        bool isAdmin = (registry.roleOf(msg.sender) == Role.Admin);
        if (!isDm && !isAdmin) revert OnlyManager(msg.sender);

        EscrowState storage e = _escrows[shipmentId];
        if (!e.deposited || e.released || e.refunded) revert NotEligible(shipmentId);

        e.frozen = true;
        emit EscrowFrozen(shipmentId);
    }

    /// @notice Unfreeze escrow. DisputeManager or Admin only.
    function unfreeze(uint256 shipmentId) external {
        bool isDm = (msg.sender == disputeManager);
        bool isAdmin = (registry.roleOf(msg.sender) == Role.Admin);
        if (!isDm && !isAdmin) revert OnlyManager(msg.sender);

        EscrowState storage e = _escrows[shipmentId];
        e.frozen = false;
        emit EscrowUnfrozen(shipmentId);
    }

    // ──────────── External Functions ────────────

    /// @notice Shipper deposits the exact configured payment amount.
    /// @dev    msg.value must exactly match the shipment's paymentAmount.
    /// @param shipmentId The shipment to fund.
    function deposit(uint256 shipmentId) external payable nonReentrant {
        registry.requireActiveParticipant(msg.sender);

        Shipment memory s = shipmentRegistry.getShipment(shipmentId);
        if (msg.sender != s.shipper) revert NotAssigned(msg.sender, shipmentId);

        EscrowState storage e = _escrows[shipmentId];
        if (e.deposited) revert AlreadyDeposited(shipmentId);

        uint256 required = s.paymentAmount;
        if (msg.value != required) revert IncorrectAmount(required, msg.value);
        if (required == 0) revert IncorrectAmount(1, 0);

        // Effects before interactions
        e.deposited = true;
        e.amount = msg.value;

        emit EscrowFunded(shipmentId, msg.sender, msg.value);
    }

    /// @notice Called by ShipmentRegistry when shipment reaches Completed.
    /// @dev    Only the ShipmentRegistry contract may call this.
    function markEligible(uint256 shipmentId) external {
        if (msg.sender != address(shipmentRegistry)) {
            revert OnlyManager(msg.sender);
        }

        EscrowState storage e = _escrows[shipmentId];
        if (!e.deposited) return;  // No escrow to mark
        e.eligible = true;

        emit PaymentEligible(shipmentId);
    }

    /// @notice Release test-ETH payment to the transporter. Pull-style, once-only.
    ///         Applies capped late penalty if delivered after expectedDelivery.
    /// @dev    Checks-effects-interactions with ReentrancyGuard.
    /// @param shipmentId The completed shipment.
    function releasePayment(uint256 shipmentId) external nonReentrant {
        registry.requireActiveParticipant(msg.sender);

        EscrowState storage e = _escrows[shipmentId];
        if (!e.deposited) revert NotDeposited(shipmentId);
        if (e.frozen) revert EscrowIsFrozen(shipmentId);
        if (!e.eligible) revert NotEligible(shipmentId);
        if (e.released) revert AlreadyReleased(shipmentId);

        Shipment memory s = shipmentRegistry.getShipment(shipmentId);
        // Only transporter can pull payment in MVP
        if (msg.sender != s.transporter) revert NotAssigned(msg.sender, shipmentId);

        uint256 totalAmount = e.amount;

        // Effects
        e.released = true;
        e.amount = 0;

        // Calculate late penalty if delivered after expectedDelivery
        uint256 penaltyAmount = 0;
        if (s.deliveredAt > s.expectedDelivery) {
            uint256 delaySec = uint256(s.deliveredAt - s.expectedDelivery);
            uint256 daysLate = (delaySec + 86399) / 86400; // ceil to integer days
            uint256 penaltyBps = daysLate * latePenaltyBpsPerDay;
            if (penaltyBps > maxPenaltyBps) {
                penaltyBps = maxPenaltyBps;
            }
            penaltyAmount = (totalAmount * penaltyBps) / 10000;
            if (penaltyAmount > 0) {
                emit PenaltyApplied(shipmentId, penaltyAmount, daysLate);
                (bool refundOk, ) = payable(s.shipper).call{value: penaltyAmount}("");
                if (!refundOk) revert TransferFailed();
            }
        }

        uint256 transporterAmount = totalAmount - penaltyAmount;

        // Interaction with transporter
        (bool ok, ) = payable(s.transporter).call{value: transporterAmount}("");
        if (!ok) revert TransferFailed();

        emit PaymentReleased(shipmentId, s.transporter, transporterAmount);
    }

    /// @notice Refund test-ETH to shipper on rejection or cancellation. Once-only.
    /// @dev    Checks-effects-interactions with ReentrancyGuard.
    /// @param shipmentId The rejected/cancelled shipment.
    function refund(uint256 shipmentId) external nonReentrant {
        registry.requireActiveParticipant(msg.sender);

        EscrowState storage e = _escrows[shipmentId];
        if (!e.deposited) revert NotDeposited(shipmentId);
        if (e.refunded) revert AlreadyRefunded(shipmentId);
        if (e.released) revert AlreadyReleased(shipmentId);
        if (e.frozen) revert EscrowIsFrozen(shipmentId);

        Shipment memory s = shipmentRegistry.getShipment(shipmentId);
        // Only shipper can pull refund
        if (msg.sender != s.shipper) revert NotAssigned(msg.sender, shipmentId);

        // Verify shipment is in a refundable state
        Status status = s.status;
        if (status != Status.Rejected && status != Status.Cancelled) {
            revert NotEligible(shipmentId);
        }

        uint256 amount = e.amount;

        // Effects
        e.refunded = true;
        e.amount = 0;

        // Interaction
        (bool ok, ) = payable(s.shipper).call{value: amount}("");
        if (!ok) revert TransferFailed();

        emit EscrowRefunded(shipmentId, s.shipper, amount);
    }

    /// @notice Settle escrow payout upon dispute resolution.
    /// @dev    Only DisputeManager can call this.
    function resolveDisputePayout(
        uint256 shipmentId,
        Resolution resolution,
        uint256 splitShipperBps
    ) external nonReentrant {
        if (msg.sender != disputeManager) revert OnlyManager(msg.sender);

        EscrowState storage e = _escrows[shipmentId];
        if (!e.deposited || e.released || e.refunded) return;

        Shipment memory s = shipmentRegistry.getShipment(shipmentId);
        uint256 totalAmount = e.amount;
        e.amount = 0;
        e.frozen = false;

        if (resolution == Resolution.ReleaseToTransporter) {
            e.released = true;
            (bool ok, ) = payable(s.transporter).call{value: totalAmount}("");
            if (!ok) revert TransferFailed();
            emit PaymentReleased(shipmentId, s.transporter, totalAmount);
        } else if (resolution == Resolution.RefundToShipper) {
            e.refunded = true;
            (bool ok, ) = payable(s.shipper).call{value: totalAmount}("");
            if (!ok) revert TransferFailed();
            emit EscrowRefunded(shipmentId, s.shipper, totalAmount);
        } else if (resolution == Resolution.Split) {
            e.released = true;
            if (splitShipperBps > 10000) revert InvalidResolution();
            uint256 shipperPart = (totalAmount * splitShipperBps) / 10000;
            uint256 transporterPart = totalAmount - shipperPart;

            if (shipperPart > 0) {
                (bool okS, ) = payable(s.shipper).call{value: shipperPart}("");
                if (!okS) revert TransferFailed();
                emit EscrowRefunded(shipmentId, s.shipper, shipperPart);
            }
            if (transporterPart > 0) {
                (bool okT, ) = payable(s.transporter).call{value: transporterPart}("");
                if (!okT) revert TransferFailed();
                emit PaymentReleased(shipmentId, s.transporter, transporterPart);
            }
        }
    }

    // ──────────── View Functions ────────────

    /// @notice Check if escrow has been deposited for a shipment.
    function isDeposited(uint256 shipmentId) external view returns (bool) {
        return _escrows[shipmentId].deposited;
    }

    /// @notice Check if escrow is frozen for a shipment.
    function isFrozen(uint256 shipmentId) external view returns (bool) {
        return _escrows[shipmentId].frozen;
    }

    /// @notice Get full escrow state for a shipment.
    function getEscrow(uint256 shipmentId)
        external
        view
        returns (
            bool deposited,
            bool eligible,
            bool released,
            bool refunded,
            uint256 amount
        )
    {
        EscrowState storage e = _escrows[shipmentId];
        return (e.deposited, e.eligible, e.released, e.refunded, e.amount);
    }
}
