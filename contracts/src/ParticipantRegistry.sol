// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CargoChainTypes.sol";

/// @title ParticipantRegistry — Role and active status management
/// @notice Implements FR-ROL-01 (register), FR-ROL-02 (revoke), FR-ROL-03 (enforce).
///         Admin is the deployer. Only Admin can register/revoke participants.
/// @dev    No upgradability in MVP (DEC-012).
contract ParticipantRegistry {
    // ──────────── State ────────────

    struct Participant {
        Role role;
        bool isActive;
        uint256 registeredBlock;
    }

    mapping(address => Participant) private _participants;
    uint256 private _participantCount;

    // ──────────── Events ────────────

    /// @notice Emitted when a participant is registered.
    event ParticipantRegistered(
        address indexed participant,
        Role indexed role,
        address indexed registeredBy
    );

    /// @notice Emitted when a participant is revoked.
    event ParticipantRevoked(
        address indexed participant,
        Role indexed role,
        address indexed revokedBy
    );

    // ──────────── Constructor ────────────

    /// @notice Registers the deployer as Admin.
    constructor() {
        _participants[msg.sender] = Participant({
            role: Role.Admin,
            isActive: true,
            registeredBlock: block.number
        });
        _participantCount = 1;
        emit ParticipantRegistered(msg.sender, Role.Admin, msg.sender);
    }

    // ──────────── Modifiers ────────────

    modifier onlyAdmin() {
        Participant storage p = _participants[msg.sender];
        if (p.role != Role.Admin || !p.isActive) {
            revert Unauthorized(msg.sender, Role.Admin);
        }
        _;
    }

    // ──────────── External Functions ────────────

    /// @notice Register a participant with a role. Admin only.
    /// @param account  Wallet address to register.
    /// @param role     Role to assign (cannot be None).
    function registerParticipant(address account, Role role) external onlyAdmin {
        if (account == address(0)) revert InvalidAddress();
        if (role == Role.None) revert Unauthorized(account, role);
        if (_participants[account].role != Role.None) {
            revert AlreadyRegistered(account);
        }

        _participants[account] = Participant({
            role: role,
            isActive: true,
            registeredBlock: block.number
        });
        _participantCount++;

        emit ParticipantRegistered(account, role, msg.sender);
    }

    /// @notice Revoke a participant. Admin only. Cannot self-revoke.
    /// @param account Wallet address to revoke.
    function revokeParticipant(address account) external onlyAdmin {
        Participant storage p = _participants[account];
        if (p.role == Role.None) revert NotRegistered(account);
        if (!p.isActive) revert InactiveParticipant(account);
        if (account == msg.sender) revert Unauthorized(msg.sender, Role.Admin);

        p.isActive = false;
        emit ParticipantRevoked(account, p.role, msg.sender);
    }

    // ──────────── View Functions ────────────

    /// @notice Returns the role of an address. None if unregistered.
    function roleOf(address account) external view returns (Role) {
        return _participants[account].role;
    }

    /// @notice Returns true if the address is registered and active.
    function isActive(address account) external view returns (bool) {
        return _participants[account].isActive;
    }

    /// @notice Returns full participant info.
    function getParticipant(address account)
        external
        view
        returns (Role role, bool active, uint256 registeredBlock)
    {
        Participant storage p = _participants[account];
        return (p.role, p.isActive, p.registeredBlock);
    }

    /// @notice Returns total registered participant count.
    function participantCount() external view returns (uint256) {
        return _participantCount;
    }

    // ──────────── Internal Helpers (used by other contracts) ────────────

    /// @notice Checks that the caller has the specified role and is active.
    function requireRole(address account, Role role) external view {
        Participant storage p = _participants[account];
        if (p.role != role || !p.isActive) {
            revert Unauthorized(account, role);
        }
    }

    /// @notice Checks that the caller has one of the allowed roles and is active.
    function requireActiveParticipant(address account) external view {
        if (!_participants[account].isActive) {
            revert InactiveParticipant(account);
        }
    }
}
