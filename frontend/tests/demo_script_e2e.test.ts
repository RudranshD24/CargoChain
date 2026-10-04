import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ethers } from "ethers";
import { CONTRACT_ABIS, CONTRACT_ADDRESSES } from "../src/contracts/config";

describe("DEMO_SCRIPT Acts 1–4 Frontend Web3 & E2E Validation", () => {
  const pRegistryIface = new ethers.Interface(CONTRACT_ABIS.ParticipantRegistry);
  const sRegistryIface = new ethers.Interface(CONTRACT_ABIS.ShipmentRegistry);
  const tManagerIface = new ethers.Interface(CONTRACT_ABIS.TrackingManager);
  const dRegistryIface = new ethers.Interface(CONTRACT_ABIS.DocumentRegistry);
  const eManagerIface = new ethers.Interface(CONTRACT_ABIS.EscrowManager);

  const sampleAdmin = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
  const sampleShipper = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8";
  const sampleTransporter = "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC";
  const sampleReceiver = "0x90F79bf6EB2c4f870365E785982E1f101E93b906";
  const sampleInspector = "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65";

  // ──────────────── Act 1 — Identity and Roles ────────────────
  describe("Act 1 — Identity and Roles (MVP)", () => {
    it("encodes registerParticipant transaction for Shipper, Transporter, Inspector, Receiver", () => {
      const rolesToRegister = [
        { addr: sampleShipper, role: 2, label: "Shipper" },
        { addr: sampleTransporter, role: 3, label: "Transporter" },
        { addr: sampleReceiver, role: 6, label: "Receiver" },
        { addr: sampleInspector, role: 5, label: "Inspector" },
      ];

      for (const item of rolesToRegister) {
        const data = pRegistryIface.encodeFunctionData("registerParticipant", [item.addr, item.role]);
        assert.ok(data.startsWith("0x"), `Failed to encode registration for ${item.label}`);
        const decoded = pRegistryIface.decodeFunctionData("registerParticipant", data);
        assert.equal(decoded[0].toLowerCase(), item.addr.toLowerCase());
        assert.equal(Number(decoded[1]), item.role);
      }
    });

    it("encodes revokeParticipant transaction", () => {
      const data = pRegistryIface.encodeFunctionData("revokeParticipant", [sampleShipper]);
      assert.ok(data.startsWith("0x"));
      const decoded = pRegistryIface.decodeFunctionData("revokeParticipant", data);
      assert.equal(decoded[0].toLowerCase(), sampleShipper.toLowerCase());
    });
  });

  // ──────────────── Act 2 — Shipment Lifecycle ────────────────
  describe("Act 2 — Shipment Lifecycle (MVP)", () => {
    it("encodes createShipment with unique external reference and terms", () => {
      const ref = ethers.keccak256(ethers.toUtf8Bytes("CARGO-ACT2-TEST"));
      const deliveryTimestamp = 1850000000;
      const paymentAmount = ethers.parseEther("1.5");

      const input = {
        externalRef: ref,
        productDescription: "Cold-chain Vaccines",
        quantity: 1000,
        origin: "Mumbai Warehouse A",
        destination: "Delhi Hub B",
        destLat: 28613900,
        destLon: 77209000,
        geofenceRadiusM: 1000,
        transporter: sampleTransporter,
        receiver: sampleReceiver,
        warehouse: ethers.ZeroAddress,
        inspector: sampleInspector,
        expectedDelivery: deliveryTimestamp,
        paymentAmount: paymentAmount,
      };

      const data = sRegistryIface.encodeFunctionData("createShipment", [input]);
      assert.ok(data.startsWith("0x"));
      const decoded = sRegistryIface.decodeFunctionData("createShipment", data);
      assert.equal(decoded[0].productDescription, "Cold-chain Vaccines");
      assert.equal(Number(decoded[0].quantity), 1000);
      assert.equal(decoded[0].paymentAmount, paymentAmount);
    });

    it("encodes acceptShipment and rejectShipment for assigned Transporter", () => {
      const acceptData = sRegistryIface.encodeFunctionData("acceptShipment", [1]);
      assert.ok(acceptData.startsWith("0x"));
      const decodedAccept = sRegistryIface.decodeFunctionData("acceptShipment", acceptData);
      assert.equal(Number(decodedAccept[0]), 1);

      const rejectData = sRegistryIface.encodeFunctionData("rejectShipment", [1]);
      assert.ok(rejectData.startsWith("0x"));
      const decodedReject = sRegistryIface.decodeFunctionData("rejectShipment", rejectData);
      assert.equal(Number(decodedReject[0]), 1);
    });

    it("encodes startTransit (dispatch) for TrackingManager", () => {
      const data = tManagerIface.encodeFunctionData("startTransit", [1, "Mumbai Depot Dispatch"]);
      assert.ok(data.startsWith("0x"));
      const decoded = tManagerIface.decodeFunctionData("startTransit", data);
      assert.equal(Number(decoded[0]), 1);
      assert.equal(decoded[1], "Mumbai Depot Dispatch");
    });

    it("encodes manual milestone recording with location and notes", () => {
      const data = tManagerIface.encodeFunctionData("recordMilestone", [
        1,
        1, // MilestoneType.InTransit
        "Highway Toll Plaza 4",
        0,
        0,
        "Driver change; security seal intact",
      ]);
      assert.ok(data.startsWith("0x"));
      const decoded = tManagerIface.decodeFunctionData("recordMilestone", data);
      assert.equal(Number(decoded[0]), 1);
      assert.equal(Number(decoded[1]), 1);
      assert.equal(decoded[2], "Highway Toll Plaza 4");
    });

    it("encodes custody transfer to new custodian", () => {
      const data = tManagerIface.encodeFunctionData("transferCustody", [1, sampleReceiver]);
      assert.ok(data.startsWith("0x"));
      const decoded = tManagerIface.decodeFunctionData("transferCustody", data);
      assert.equal(Number(decoded[0]), 1);
      assert.equal(decoded[1].toLowerCase(), sampleReceiver.toLowerCase());
    });
  });

  // ──────────────── Act 3 — Documents and Escrow ────────────────
  describe("Act 3 — Documents and Escrow (MVP)", () => {
    it("encodes document registration with SHA-256 hash and IPFS CID", () => {
      const fileBytes = Buffer.from("Bill of Lading CargoChain Authentic Content");
      const sha256Hash = ethers.sha256(fileBytes);
      const mockCid = "QmTestCargoChainCID1234567890";

      const data = dRegistryIface.encodeFunctionData("registerDocument", [
        1,
        1, // DocType.BillOfLading
        sha256Hash,
        mockCid,
      ]);
      assert.ok(data.startsWith("0x"));
      const decoded = dRegistryIface.decodeFunctionData("registerDocument", data);
      assert.equal(Number(decoded[0]), 1);
      assert.equal(Number(decoded[1]), 1);
      assert.equal(decoded[2], sha256Hash);
      assert.equal(decoded[3], mockCid);
    });

    it("verifies hash matching logic distinguishes authentic vs tampered document", () => {
      const originalFile = Buffer.from("Authentic Pharmaceutical Manifest Batch 404");
      const tamperedFile = Buffer.from("Forged Pharmaceutical Manifest Batch 404 (Altered Quantity)");

      const originalHash = ethers.sha256(originalFile);
      const tamperedHash = ethers.sha256(tamperedFile);

      assert.equal(originalHash.toLowerCase(), ethers.sha256(originalFile).toLowerCase());
      assert.notEqual(originalHash.toLowerCase(), tamperedHash.toLowerCase());
    });

    it("encodes exact test-ETH escrow deposit, release, and refund", () => {
      const depositData = eManagerIface.encodeFunctionData("deposit", [1]);
      assert.ok(depositData.startsWith("0x"));
      const decodedDeposit = eManagerIface.decodeFunctionData("deposit", depositData);
      assert.equal(Number(decodedDeposit[0]), 1);

      const releaseData = eManagerIface.encodeFunctionData("releasePayment", [1]);
      assert.ok(releaseData.startsWith("0x"));
      const decodedRelease = eManagerIface.decodeFunctionData("releasePayment", releaseData);
      assert.equal(Number(decodedRelease[0]), 1);

      const refundData = eManagerIface.encodeFunctionData("refund", [1]);
      assert.ok(refundData.startsWith("0x"));
      const decodedRefund = eManagerIface.decodeFunctionData("refund", refundData);
      assert.equal(Number(decodedRefund[0]), 1);
    });
  });

  // ──────────────── Act 4 — Audit and Read-Model Recovery ────────────────
  describe("Act 4 — Audit and Read-Model Recovery (MVP)", () => {
    it("validates event topic definitions for all critical lifecycle events", () => {
      // ParticipantRegistered
      const pRegEvent = pRegistryIface.getEvent("ParticipantRegistered");
      assert.ok(pRegEvent, "ParticipantRegistered event signature missing");

      // ShipmentCreated
      const sCreatedEvent = sRegistryIface.getEvent("ShipmentCreated");
      assert.ok(sCreatedEvent, "ShipmentCreated event signature missing");

      // StatusChanged
      const statusChangedEvent = sRegistryIface.getEvent("StatusChanged");
      assert.ok(statusChangedEvent, "StatusChanged event signature missing");

      // MilestoneRecorded
      const milestoneEvent = tManagerIface.getEvent("MilestoneRecorded");
      assert.ok(milestoneEvent, "MilestoneRecorded event signature missing");

      // DocumentRegistered
      const docEvent = dRegistryIface.getEvent("DocumentRegistered");
      assert.ok(docEvent, "DocumentRegistered event signature missing");

      // EscrowFunded, PaymentReleased, EscrowRefunded
      const fundedEvent = eManagerIface.getEvent("EscrowFunded");
      const releasedEvent = eManagerIface.getEvent("PaymentReleased");
      const refundedEvent = eManagerIface.getEvent("EscrowRefunded");
      assert.ok(fundedEvent, "EscrowFunded event signature missing");
      assert.ok(releasedEvent, "PaymentReleased event signature missing");
      assert.ok(refundedEvent, "EscrowRefunded event signature missing");
    });
  });

  describe("Act 5 — Oracle Milestones & Exception Scenarios (Phase 4)", () => {
    it("encodes submitOracleUpdate milestone report for TrackingManager", () => {
      const trackingInterface = new ethers.Interface(CONTRACT_ABIS.TrackingManager);
      const data = trackingInterface.encodeFunctionData("submitOracleUpdate", [
        1,
        18520430, // 18.520430 lat
        73856743, // 73.856743 lon
        3,        // MilestoneType.Arrived
        "ipfs://bafybeioraclereport123",
      ]);
      assert.ok(data.startsWith("0x"), "Encoded transaction data should start with 0x");
      assert.ok(data.length > 10, "Encoded call data should not be empty");
    });

    it("encodes raiseDispute transaction for DisputeManager", () => {
      const disputeInterface = new ethers.Interface(CONTRACT_ABIS.DisputeManager);
      const data = disputeInterface.encodeFunctionData("raiseDispute", [
        1,
        0, // DisputeReason.Damaged
        "Severe water damage detected at destination warehouse",
      ]);
      assert.ok(data.startsWith("0x"), "Encoded transaction data should start with 0x");
    });

    it("encodes resolveDispute transaction with split resolution for DisputeManager", () => {
      const disputeInterface = new ethers.Interface(CONTRACT_ABIS.DisputeManager);
      const data = disputeInterface.encodeFunctionData("resolveDispute", [
        1,
        2,    // Resolution.Split
        5000, // 50% to shipper (5000 bps)
        "Admin arbitration: 50/50 split agreed by parties",
      ]);
      assert.ok(data.startsWith("0x"), "Encoded transaction data should start with 0x");
    });
  });
});
