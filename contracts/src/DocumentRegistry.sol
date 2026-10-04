// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import "./CargoChainTypes.sol";
import "./ParticipantRegistry.sol";
import "./ShipmentRegistry.sol";

/// @title DocumentRegistry — Hash/CID anchoring and verification
/// @notice Implements FR-DOC-02 (anchor hash on-chain) and FR-DOC-03 (verify).
///         Documents stay off-chain; only SHA-256 and CID are anchored.
contract DocumentRegistry {
    // ──────────── State ────────────

    ParticipantRegistry public immutable registry;
    ShipmentRegistry public immutable shipmentRegistry;

    /// @dev shipmentId => list of anchored documents
    mapping(uint256 => Document[]) private _documents;

    /// @dev contentHash => bool for global uniqueness check
    mapping(bytes32 => bool) private _registeredHashes;

    // ──────────── Events ────────────

    /// @notice Emitted when a document hash/CID is anchored.
    event DocumentRegistered(
        uint256 indexed shipmentId,
        uint256 indexed docIndex,
        DocType indexed docType,
        bytes32 contentHash,
        string cid,
        address uploader
    );

    /// @notice Emitted when a document integrity check is performed on-chain.
    event DocumentVerified(
        uint256 indexed shipmentId,
        uint256 indexed docIndex,
        bool matched,
        address verifier
    );

    // ──────────── Constructor ────────────

    constructor(address _registry, address _shipmentRegistry) {
        if (_registry == address(0) || _shipmentRegistry == address(0)) {
            revert InvalidAddress();
        }
        registry = ParticipantRegistry(_registry);
        shipmentRegistry = ShipmentRegistry(_shipmentRegistry);
    }

    // ──────────── External Functions ────────────

    /// @notice Anchor a document hash and CID on-chain.
    /// @dev    Shipper or Inspector of the shipment may register documents.
    ///         Upload to IPFS and hash computation happen off-chain (API).
    /// @param shipmentId  The shipment this document belongs to.
    /// @param docType     Document type enum.
    /// @param contentHash SHA-256 hash of the raw file bytes.
    /// @param cid         IPFS content identifier string.
    /// @return docIndex   The per-shipment document index.
    function registerDocument(
        uint256 shipmentId,
        DocType docType,
        bytes32 contentHash,
        string calldata cid
    ) external returns (uint256 docIndex) {
        registry.requireActiveParticipant(msg.sender);

        // Verify shipment exists
        Shipment memory s = shipmentRegistry.getShipment(shipmentId);

        // Only Shipper or Inspector may anchor documents
        bool isSender = (msg.sender == s.shipper);
        bool isInspector = (s.inspector != address(0) && msg.sender == s.inspector);
        if (!isSender && !isInspector) revert NotAssigned(msg.sender, shipmentId);

        // Hash must not be empty or already registered
        if (contentHash == bytes32(0)) revert InvalidAddress(); // repurpose for "invalid input"
        if (_registeredHashes[contentHash]) {
            revert HashAlreadyRegistered(contentHash);
        }

        docIndex = _documents[shipmentId].length;

        _documents[shipmentId].push(Document({
            shipmentId: shipmentId,
            docIndex: docIndex,
            docType: docType,
            contentHash: contentHash,
            cid: cid,
            uploader: msg.sender,
            blockTime: block.timestamp
        }));

        _registeredHashes[contentHash] = true;

        emit DocumentRegistered(shipmentId, docIndex, docType, contentHash, cid, msg.sender);
    }

    /// @notice Verify a document by comparing a provided hash to the anchored hash.
    /// @dev    Emits DocumentVerified with match result. View-like but emits event.
    /// @param shipmentId The shipment ID.
    /// @param docIndex   The per-shipment document index.
    /// @param hash       The SHA-256 hash to compare (recomputed from file bytes off-chain).
    /// @return matched   True if hashes match.
    /// @return storedHash The anchored hash for reference.
    function verifyDocument(uint256 shipmentId, uint256 docIndex, bytes32 hash)
        external
        returns (bool matched, bytes32 storedHash)
    {
        registry.requireActiveParticipant(msg.sender);

        Document[] storage docs = _documents[shipmentId];
        if (docIndex >= docs.length) revert InvalidDocIndex(shipmentId, docIndex);

        storedHash = docs[docIndex].contentHash;
        matched = (hash == storedHash);

        emit DocumentVerified(shipmentId, docIndex, matched, msg.sender);
    }

    // ──────────── View Functions ────────────

    /// @notice Check if a specific hash has been registered.
    function isHashRegistered(bytes32 hash) external view returns (bool) {
        return _registeredHashes[hash];
    }

    /// @notice Get documents for a shipment (paginated).
    function getDocuments(uint256 shipmentId, uint256 offset, uint256 limit)
        external
        view
        returns (Document[] memory result)
    {
        Document[] storage all = _documents[shipmentId];
        if (offset >= all.length) return new Document[](0);

        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        uint256 count = end - offset;

        result = new Document[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = all[offset + i];
        }
    }

    /// @notice Returns total document count for a shipment.
    function documentCount(uint256 shipmentId) external view returns (uint256) {
        return _documents[shipmentId].length;
    }
}
