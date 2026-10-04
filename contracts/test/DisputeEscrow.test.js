const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture, time } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("DisputeEscrow (FR-DSP-01, FR-ESC-05..07)", function () {
  async function disputeFixture() {
    const [admin, shipper, transporter, receiver, outsider] =
      await ethers.getSigners();

    // 1. ParticipantRegistry
    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    await registry.registerParticipant(shipper.address, 2);      // Shipper
    await registry.registerParticipant(transporter.address, 3);  // Transporter
    await registry.registerParticipant(receiver.address, 6);     // Receiver
    await registry.registerParticipant(outsider.address, 5);     // Active Inspector (unassigned)

    // 2. ShipmentRegistry
    const ShipmentReg = await ethers.getContractFactory("ShipmentRegistry");
    const shipmentRegistry = await ShipmentReg.deploy(await registry.getAddress());

    // 3. TrackingManager
    const TrackingMgr = await ethers.getContractFactory("TrackingManager");
    const trackingManager = await TrackingMgr.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 4. EscrowManager
    const EscrowMgr = await ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowMgr.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 5. DisputeManager
    const DisputeMgr = await ethers.getContractFactory("DisputeManager");
    const disputeManager = await DisputeMgr.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress(),
      await escrowManager.getAddress()
    );

    // Wire managers
    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());
    await shipmentRegistry.setEscrowManager(await escrowManager.getAddress());
    await shipmentRegistry.setDisputeManager(await disputeManager.getAddress());
    await escrowManager.setDisputeManager(await disputeManager.getAddress());

    const depositAmount = ethers.parseEther("1.0");
    const expectedDelivery = (await time.latest()) + 86400 * 5;

    const shipmentInput = {
      externalRef: ethers.encodeBytes32String("DISPUTE-001"),
      productDescription: "Machinery",
      quantity: 1,
      origin: "Chennai",
      destination: "Bengaluru",
      destLat: 12971600,
      destLon: 77594600,
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: ethers.ZeroAddress,
      inspector: ethers.ZeroAddress,
      expectedDelivery: expectedDelivery,
      paymentAmount: depositAmount,
    };

    return {
      registry,
      shipmentRegistry,
      trackingManager,
      escrowManager,
      disputeManager,
      admin,
      shipper,
      transporter,
      receiver,
      outsider,
      depositAmount,
      shipmentInput,
    };
  }

  async function createFundedAndDispatchedShipment(f, ref = "DISPUTE-DISP") {
    const input = { ...f.shipmentInput, externalRef: ethers.encodeBytes32String(ref) };
    const tx = await f.shipmentRegistry.connect(f.shipper).createShipment(input);
    const rc = await tx.wait();
    const id = 1n; // or fetched from event

    await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
    await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
    await f.trackingManager.connect(f.transporter).startTransit(id, "Chennai Terminal");
    return id;
  }

  describe("FR-DSP-01 & FR-ESC-05: Raising Disputes & Escrow Freeze", function () {
    it("allows Shipper to raise a dispute in InTransit status and freezes escrow", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "DISP-SHIPPER");

      expect(await f.escrowManager.isFrozen(id)).to.be.false;

      await expect(
        f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Package damaged during handling") // 0 = Damaged
      )
        .to.emit(f.disputeManager, "DisputeRaised")
        .withArgs(id, f.shipper.address, 0, "Package damaged during handling")
        .and.to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(id, 2, 8, await f.disputeManager.getAddress()) // 2 = InTransit, 8 = Disputed
        .and.to.emit(f.escrowManager, "EscrowFrozen")
        .withArgs(id);

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(8); // Disputed
      expect(await f.escrowManager.isFrozen(id)).to.be.true;

      // Reverts refund attempt while frozen
      await expect(
        f.escrowManager.connect(f.shipper).refund(id)
      ).to.be.revertedWithCustomError(f.escrowManager, "EscrowIsFrozen");
    });

    it("allows Receiver to raise a dispute when shipment is Delivered", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "DISP-RECEIVER");

      // Transporter arrives and receiver confirms delivery as Damaged
      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Bengaluru Yard");
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 1); // Condition = Damaged

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(5); // Delivered

      await expect(
        f.disputeManager.connect(f.receiver).raiseDispute(id, 0, "Items arrived severely damaged")
      )
        .to.emit(f.disputeManager, "DisputeRaised")
        .withArgs(id, f.receiver.address, 0, "Items arrived severely damaged");

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(8); // Disputed
    });

    it("reverts dispute if raised by unassigned party", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "DISP-UNASSIGNED");

      await expect(
        f.disputeManager.connect(f.outsider).raiseDispute(id, 0, "Invalid caller")
      ).to.be.revertedWithCustomError(f.disputeManager, "NotAssigned");
    });

    it("reverts dispute if shipment is not in eligible status (e.g. Created)", async function () {
      const f = await loadFixture(disputeFixture);
      const input = { ...f.shipmentInput, externalRef: ethers.encodeBytes32String("DISP-CREATED") };
      await f.shipmentRegistry.connect(f.shipper).createShipment(input);
      const id = 1n;

      await expect(
        f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Cannot dispute Created")
      ).to.be.revertedWithCustomError(f.disputeManager, "DisputeNotAllowed");
    });

    it("reverts duplicate dispute raise", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "DISP-DUP");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "First dispute");

      await expect(
        f.disputeManager.connect(f.receiver).raiseDispute(id, 0, "Second dispute")
      ).to.be.revertedWithCustomError(f.disputeManager, "DisputeAlreadyOpen");
    });
  });

  describe("FR-DSP-01: Dispute Resolution Outcomes & Payout Paths", function () {
    it("Admin resolves with ReleaseToTransporter -> Completed, releases payment to Transporter", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-TRANSP");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 2, "Transit delayed"); // 2 = Delayed

      const initialTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      await expect(
        f.disputeManager
          .connect(f.admin)
          .resolveDispute(id, 0, 0, "Delay justified due to weather") // 0 = ReleaseToTransporter
      )
        .to.emit(f.disputeManager, "DisputeResolved")
        .withArgs(id, f.admin.address, 0, "Delay justified due to weather")
        .and.to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(id, 8, 6, await f.disputeManager.getAddress()) // 8 = Disputed, 6 = Completed
        .and.to.emit(f.escrowManager, "PaymentReleased")
        .withArgs(id, f.transporter.address, f.depositAmount);

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(6); // Completed
      expect(await f.escrowManager.isFrozen(id)).to.be.false;

      const finalTransporterBal = await ethers.provider.getBalance(f.transporter.address);
      expect(finalTransporterBal - initialTransporterBal).to.equal(f.depositAmount);
    });

    it("Admin resolves with RefundToShipper -> Cancelled, refunds test-ETH to Shipper", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-SHIPPER");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Goods ruined");

      const initialShipperBal = await ethers.provider.getBalance(f.shipper.address);

      await expect(
        f.disputeManager
          .connect(f.admin)
          .resolveDispute(id, 1, 0, "Fault confirmed on carrier") // 1 = RefundToShipper
      )
        .to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(id, 8, 9, await f.disputeManager.getAddress()) // 8 = Disputed, 9 = Cancelled
        .and.to.emit(f.escrowManager, "EscrowRefunded")
        .withArgs(id, f.shipper.address, f.depositAmount);

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(9); // Cancelled
      const finalShipperBal = await ethers.provider.getBalance(f.shipper.address);
      expect(finalShipperBal - initialShipperBal).to.equal(f.depositAmount);
    });

    it("Admin resolves with Split -> Completed, divides payout according to basis points", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-SPLIT");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 3, "Mutual disagreement");

      const initialShipperBal = await ethers.provider.getBalance(f.shipper.address);
      const initialTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      // Split 40% (4000 bps) to shipper, 60% (6000 bps) to transporter
      const splitShipperBps = 4000n;
      const expectedShipperShare = (f.depositAmount * splitShipperBps) / 10000n;
      const expectedTransporterShare = f.depositAmount - expectedShipperShare;

      await expect(
        f.disputeManager
          .connect(f.admin)
          .resolveDispute(id, 2, splitShipperBps, "Compromise settlement") // 2 = Split
      )
        .to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(id, 8, 6, await f.disputeManager.getAddress())
        .and.to.emit(f.escrowManager, "EscrowRefunded")
        .withArgs(id, f.shipper.address, expectedShipperShare)
        .and.to.emit(f.escrowManager, "PaymentReleased")
        .withArgs(id, f.transporter.address, expectedTransporterShare);

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(6); // Completed

      const finalShipperBal = await ethers.provider.getBalance(f.shipper.address);
      const finalTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      expect(finalShipperBal - initialShipperBal).to.equal(expectedShipperShare);
      expect(finalTransporterBal - initialTransporterBal).to.equal(expectedTransporterShare);
    });

    it("reverts resolution by non-admin", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-UNAUTH");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Test dispute");

      await expect(
        f.disputeManager.connect(f.shipper).resolveDispute(id, 0, 0, "Cannot self-resolve")
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });

    it("reverts attempted normal releasePayment while escrow is frozen", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-FROZEN-REL");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Freeze check");

      await expect(
        f.escrowManager.connect(f.transporter).releasePayment(id)
      ).to.be.revertedWithCustomError(f.escrowManager, "EscrowIsFrozen");
    });

    it("reverts duplicate resolution or resolution after dispute is resolved", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-DUP-RESOLVE");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 0, "Freeze check");

      await f.disputeManager.connect(f.admin).resolveDispute(id, 0, 0, "First resolution");

      // Attempting to resolve again reverts DisputeAlreadyOpen (or already closed/resolved)
      await expect(
        f.disputeManager.connect(f.admin).resolveDispute(id, 0, 0, "Second resolution attempt")
      ).to.be.revertedWithCustomError(f.disputeManager, "DisputeAlreadyOpen");
    });

    it("reverts split resolution when split basis points exceed 10000", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "RES-INVALID-SPLIT");
      await f.disputeManager.connect(f.shipper).raiseDispute(id, 3, "Split test");

      await expect(
        f.disputeManager.connect(f.admin).resolveDispute(id, 2, 10001, "Invalid bps") // 2 = Split, >10000 bps
      ).to.be.revertedWithCustomError(f.escrowManager, "InvalidResolution");
    });
  });

  describe("FR-ESC-06: Capped Late-Delivery Penalty Calculation", function () {
    it("deducts late penalty and refunds shipper when delivered after expectedDelivery", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "LATE-SHIPMENT");

      // Arrive at warehouse
      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Bengaluru Terminal");

      // Fast-forward time past expectedDelivery by 3 days
      // 3 days late: penalty = 3 * 200 bps = 600 bps = 6%
      await time.increase(86400 * 8); // Now well past expectedDelivery

      // Confirm delivery and accept delivery
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 0); // Condition = Intact
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      const initialShipperBal = await ethers.provider.getBalance(f.shipper.address);
      const initialTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      // Release payment
      const tx = await f.escrowManager.connect(f.transporter).releasePayment(id);
      const rc = await tx.wait();
      const gasUsed = rc.gasUsed * rc.gasPrice;

      // Check penalty event
      await expect(tx).to.emit(f.escrowManager, "PenaltyApplied");

      // Verify balances: Shipper received penalty refund; transporter received remainder
      const finalShipperBal = await ethers.provider.getBalance(f.shipper.address);
      const finalTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      const penaltyRefund = finalShipperBal - initialShipperBal;
      expect(penaltyRefund).to.be.gt(0n);

      const transporterPayout = finalTransporterBal - initialTransporterBal + gasUsed;
      expect(penaltyRefund + transporterPayout).to.equal(f.depositAmount);
    });

    it("caps late penalty at maxPenaltyBps (30%) even for extreme delays", async function () {
      const f = await loadFixture(disputeFixture);
      const id = await createFundedAndDispatchedShipment(f, "EXTREME-LATE");

      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Bengaluru Yard");

      // Fast-forward 100 days
      await time.increase(86400 * 100);

      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 0);
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      const initialShipperBal = await ethers.provider.getBalance(f.shipper.address);

      const tx = await f.escrowManager.connect(f.transporter).releasePayment(id);
      await tx.wait();

      const finalShipperBal = await ethers.provider.getBalance(f.shipper.address);
      const penaltyRefund = finalShipperBal - initialShipperBal;

      // 30% of 1.0 ETH = 0.3 ETH
      const maxExpectedPenalty = (f.depositAmount * 3000n) / 10000n;
      expect(penaltyRefund).to.equal(maxExpectedPenalty);
    });
  });

  describe("FR-ESC-07: Configurable Escrow Rules", function () {
    it("allows Admin to update penalty rules and emits RuleChanged", async function () {
      const f = await loadFixture(disputeFixture);

      await expect(f.escrowManager.connect(f.admin).setRules(300, 4000))
        .to.emit(f.escrowManager, "RuleChanged")
        .withArgs(300, 4000);

      expect(await f.escrowManager.latePenaltyBpsPerDay()).to.equal(300n);
      expect(await f.escrowManager.maxPenaltyBps()).to.equal(4000n);
    });

    it("reverts setRules when called by non-admin", async function () {
      const f = await loadFixture(disputeFixture);

      await expect(
        f.escrowManager.connect(f.shipper).setRules(300, 4000)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });
  });
});
