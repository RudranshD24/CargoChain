const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("Phase 6 Security Lab: Isolated Controlled Attack Demonstrations", function () {
  async function fullSecurityFixture() {
    const [admin, shipper, transporter, receiver, warehouse, inspector, attackerUser, outsider] =
      await ethers.getSigners();

    // 1. ParticipantRegistry (admin is deployer)
    const ParticipantRegistry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await ParticipantRegistry.deploy();

    // Register active participants
    await registry.connect(admin).registerParticipant(shipper.address, 2); // Shipper
    await registry.connect(admin).registerParticipant(transporter.address, 3); // Transporter
    await registry.connect(admin).registerParticipant(warehouse.address, 4); // Warehouse
    await registry.connect(admin).registerParticipant(inspector.address, 5); // Inspector
    await registry.connect(admin).registerParticipant(receiver.address, 6); // Receiver

    // 2. ShipmentRegistry
    const ShipmentRegistry = await ethers.getContractFactory("ShipmentRegistry");
    const shipmentRegistry = await ShipmentRegistry.deploy(await registry.getAddress());

    // 3. TrackingManager
    const TrackingManager = await ethers.getContractFactory("TrackingManager");
    const trackingManager = await TrackingManager.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 4. DocumentRegistry
    const DocumentRegistry = await ethers.getContractFactory("DocumentRegistry");
    const documentRegistry = await DocumentRegistry.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 5. EscrowManager
    const EscrowManager = await ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowManager.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 6. DisputeManager
    const DisputeManager = await ethers.getContractFactory("DisputeManager");
    const disputeManager = await DisputeManager.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress(),
      await escrowManager.getAddress()
    );

    // Wire managers into ShipmentRegistry & EscrowManager
    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());
    await shipmentRegistry.setEscrowManager(await escrowManager.getAddress());
    await shipmentRegistry.setDisputeManager(await disputeManager.getAddress());
    await escrowManager.setDisputeManager(await disputeManager.getAddress());

    // Deploy ReentrancyAttacker contract
    const AttackerFactory = await ethers.getContractFactory("ReentrancyAttacker");
    const reentrancyAttacker = await AttackerFactory.deploy(await escrowManager.getAddress());

    const depositAmount = ethers.parseEther("1.0");

    const defaultInput = {
      externalRef: ethers.encodeBytes32String("SEC-SHIPMENT-001"),
      productDescription: "Secured Pharmaceuticals",
      quantity: 50,
      origin: "Facility Alpha",
      destination: "Facility Omega",
      destLat: 28613939,
      destLon: 77209021,
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 5,
      paymentAmount: depositAmount,
    };

    return {
      registry,
      shipmentRegistry,
      trackingManager,
      documentRegistry,
      escrowManager,
      disputeManager,
      reentrancyAttacker,
      admin,
      shipper,
      transporter,
      receiver,
      warehouse,
      inspector,
      attackerUser,
      outsider,
      depositAmount,
      defaultInput,
    };
  }

  describe("Attack Vector 1: Reentrancy Exploitation on Escrow Payouts", function () {
    it("prevents reentrancy recursion during releasePayment via ReentrancyGuard mutex", async function () {
      const f = await loadFixture(fullSecurityFixture);
      const attackerAddr = await f.reentrancyAttacker.getAddress();

      // Register attacker contract as Transporter
      await f.registry.connect(f.admin).registerParticipant(attackerAddr, 3);

      const attackInput = {
        ...f.defaultInput,
        externalRef: ethers.encodeBytes32String("REENT-ATTACK-RELEASE"),
        transporter: attackerAddr,
      };

      await f.shipmentRegistry.connect(f.shipper).createShipment(attackInput);
      const id = 1n;
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      // Attacker accepts and progresses to completion
      const acceptData = new ethers.Interface(["function acceptShipment(uint256 id)"]).encodeFunctionData("acceptShipment", [id]);
      await f.reentrancyAttacker.execute(await f.shipmentRegistry.getAddress(), 0, acceptData);

      const startData = new ethers.Interface(["function startTransit(uint256 id, string location)"]).encodeFunctionData("startTransit", [id, "Attack Hub"]);
      await f.reentrancyAttacker.execute(await f.trackingManager.getAddress(), 0, startData);

      const arrivalData = new ethers.Interface(["function confirmWarehouseArrival(uint256 id, string location)"]).encodeFunctionData("confirmWarehouseArrival", [id, "Dest Hub"]);
      await f.reentrancyAttacker.execute(await f.trackingManager.getAddress(), 0, arrivalData);

      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 0); // Intact
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      // Launch reentrancy attack on releasePayment
      await f.reentrancyAttacker.attackReleasePayment(id);

      // Mutex prevented recursive drain: exactly 1 legitimate payment succeeded
      expect(await f.reentrancyAttacker.attackCount()).to.equal(1n);
      expect(await f.reentrancyAttacker.reentrancySucceeded()).to.be.false;

      // Attacker received exactly legitimate deposit amount
      const attackerBal = await ethers.provider.getBalance(attackerAddr);
      expect(attackerBal).to.equal(f.depositAmount);

      // Escrow contract balance is drained legitimately to 0, not negative/underflow
      const escrowBal = await ethers.provider.getBalance(await f.escrowManager.getAddress());
      expect(escrowBal).to.equal(0n);
    });

    it("prevents reentrancy recursion during refund on cancellation via ReentrancyGuard", async function () {
      const f = await loadFixture(fullSecurityFixture);
      const attackerAddr = await f.reentrancyAttacker.getAddress();

      // Register attacker contract as Shipper
      await f.registry.connect(f.admin).registerParticipant(attackerAddr, 2);

      const createIface = new ethers.Interface([
        "function createShipment((bytes32 externalRef, string productDescription, uint32 quantity, string origin, string destination, int32 destLat, int32 destLon, uint32 geofenceRadiusM, address transporter, address receiver, address warehouse, address inspector, uint64 expectedDelivery, uint256 paymentAmount)) returns (uint256)",
      ]);
      const attackInput = {
        ...f.defaultInput,
        externalRef: ethers.encodeBytes32String("REENT-ATTACK-REFUND"),
      };
      const createData = createIface.encodeFunctionData("createShipment", [attackInput]);
      await f.reentrancyAttacker.execute(await f.shipmentRegistry.getAddress(), 0, createData);
      const id = 1n;

      // Attacker deposits escrow
      const depositIface = new ethers.Interface(["function deposit(uint256 shipmentId)"]);
      const depositData = depositIface.encodeFunctionData("deposit", [id]);
      await f.reentrancyAttacker.execute(
        await f.escrowManager.getAddress(),
        f.depositAmount,
        depositData,
        { value: f.depositAmount }
      );

      // Transporter rejects shipment (making escrow refundable)
      await f.shipmentRegistry.connect(f.transporter).rejectShipment(id);

      // Attacker launches reentrant refund attack
      await f.reentrancyAttacker.attackRefund(id);

      expect(await f.reentrancyAttacker.attackCount()).to.equal(1n);
      expect(await f.reentrancyAttacker.reentrancySucceeded()).to.be.false;

      const escrowBal = await ethers.provider.getBalance(await f.escrowManager.getAddress());
      expect(escrowBal).to.equal(0n);
    });
  });

  describe("Attack Vector 2: State Machine Invariant Violation Fuzzing", function () {
    it("strictly blocks illegal state transition jumps", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;

      // 1. Created -> Delivered (Must revert)
      await expect(
        f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 0)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");

      // 2. Created -> Completed (Must revert)
      await expect(
        f.shipmentRegistry.connect(f.receiver).acceptDelivery(id)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");

      // 3. Accepted -> Completed (Must revert)
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await expect(
        f.shipmentRegistry.connect(f.receiver).acceptDelivery(id)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");

      // 4. InTransit -> Completed (Must revert without Arrived/Delivered)
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.trackingManager.connect(f.transporter).startTransit(id, "Origin Hub");

      await expect(
        f.shipmentRegistry.connect(f.receiver).acceptDelivery(id)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");
    });

    it("prevents any mutation once shipment reaches terminal Completed state", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;

      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Transit Depot");
      await f.trackingManager.connect(f.warehouse).confirmWarehouseArrival(id, "Terminal");
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 0);
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      // Now Completed: Attempt any transition
      await expect(
        f.shipmentRegistry.connect(f.shipper).cancelShipment(id)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");

      await expect(
        f.shipmentRegistry.connect(f.transporter).acceptShipment(id)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");

      await expect(
        f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Too late")
      ).to.be.revertedWithCustomError(f.disputeManager, "DisputeNotAllowed");
    });
  });

  describe("Attack Vector 3: Privilege Escalation & Unauthorized Access", function () {
    it("reverts when non-admin attempts to register or revoke participants", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await expect(
        f.registry.connect(f.attackerUser).registerParticipant(f.outsider.address, 2)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");

      await expect(
        f.registry.connect(f.attackerUser).revokeParticipant(f.shipper.address)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });

    it("reverts when unauthorized caller attempts to transfer physical custody", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Depot");

      // Current custodian is transporter. Active participant (warehouse) attempts to hijack custody.
      await expect(
        f.trackingManager.connect(f.warehouse).transferCustody(id, f.receiver.address)
      ).to.be.revertedWithCustomError(f.trackingManager, "NotCustodian");
    });

    it("reverts when non-admin attempts to configure escrow penalty rules", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await expect(
        f.escrowManager.connect(f.attackerUser).setRules(500, 5000)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });
  });

  describe("Attack Vector 4: Escrow & Dispute Boundary Exploits", function () {
    it("reverts dispute split resolution exceeding 100% basis points", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Depot");

      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Carrier breach");

      // Attempt split with 12000 bps (120%) - Resolution.Split is 2
      await expect(
        f.disputeManager.connect(f.admin).resolveDispute(id, 2, 12000, "Invalid split attempt")
      ).to.be.revertedWithCustomError(f.escrowManager, "InvalidResolution");
    });

    it("prevents double-resolution attack on already resolved disputes", async function () {
      const f = await loadFixture(fullSecurityFixture);
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Depot");

      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Carrier breach");

      // First resolution succeeds (Resolution.ReleaseToTransporter is 0)
      await f.disputeManager.connect(f.admin).resolveDispute(id, 0, 0, "Initial legitimate resolution");

      // Replay attack: attempt second resolution (Resolution.RefundToShipper is 1)
      await expect(
        f.disputeManager.connect(f.admin).resolveDispute(id, 1, 0, "Second unauthorized resolution")
      ).to.be.revertedWithCustomError(f.disputeManager, "DisputeAlreadyOpen");
    });
  });

  describe("Attack Vector 5: Oracle Permission Containment", function () {
    it("confirms Oracle role cannot execute non-Oracle business operations", async function () {
      const f = await loadFixture(fullSecurityFixture);
      const oracleSigner = f.outsider;
      await f.registry.connect(f.admin).registerParticipant(oracleSigner.address, 7); // Role.Oracle

      // Create valid shipment first
      await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
      const id = 1n;

      // Oracle cannot create shipment
      await expect(
        f.shipmentRegistry.connect(oracleSigner).createShipment(f.defaultInput)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "Unauthorized");

      // Oracle cannot register documents
      const docHash = ethers.sha256(ethers.toUtf8Bytes("Oracle Fake Document"));
      await expect(
        f.documentRegistry.connect(oracleSigner).registerDocument(id, 0, docHash, "ipfs://fake")
      ).to.be.revertedWithCustomError(f.documentRegistry, "NotAssigned");

      // Oracle cannot resolve disputes
      await expect(
        f.disputeManager.connect(oracleSigner).resolveDispute(id, 0, 0, "Oracle fake resolution")
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });
  });
});
