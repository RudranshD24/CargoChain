const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("EscrowManager", function () {
  async function fullFixture() {
    const [admin, shipper, transporter, warehouse, inspector, receiver, outsider] =
      await ethers.getSigners();

    // 1. ParticipantRegistry
    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    await registry.registerParticipant(shipper.address, 2);      // Shipper
    await registry.registerParticipant(transporter.address, 3);  // Transporter
    await registry.registerParticipant(warehouse.address, 4);    // Warehouse
    await registry.registerParticipant(inspector.address, 5);    // Inspector
    await registry.registerParticipant(receiver.address, 6);     // Receiver

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

    // Link managers in ShipmentRegistry
    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());
    await shipmentRegistry.setEscrowManager(await escrowManager.getAddress());

    const depositAmount = ethers.parseEther("1.0");

    const defaultInput = {
      externalRef: ethers.encodeBytes32String("ESCROW-001"),
      productDescription: "Industrial Machinery",
      quantity: 1,
      origin: "Chennai",
      destination: "Kolkata",
      destLat: 22572600,
      destLon: 88363900,
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 7,
      paymentAmount: depositAmount,
    };

    return {
      registry,
      shipmentRegistry,
      trackingManager,
      escrowManager,
      depositAmount,
      defaultInput,
      admin,
      shipper,
      transporter,
      warehouse,
      inspector,
      receiver,
      outsider,
    };
  }

  async function createShipment(f, refStr = "ESCROW-001") {
    const input = {
      ...f.defaultInput,
      externalRef: ethers.encodeBytes32String(refStr),
    };
    const tx = await f.shipmentRegistry.connect(f.shipper).createShipment(input);
    await tx.wait();
    return 1n;
  }

  describe("Constructor & Initialization", function () {
    it("deploys with correct registry addresses", async function () {
      const f = await loadFixture(fullFixture);
      expect(await f.escrowManager.registry()).to.equal(await f.registry.getAddress());
      expect(await f.escrowManager.shipmentRegistry()).to.equal(
        await f.shipmentRegistry.getAddress()
      );
    });

    it("reverts on zero address inputs", async function () {
      const EscrowMgr = await ethers.getContractFactory("EscrowManager");
      const [admin] = await ethers.getSigners();
      await expect(
        EscrowMgr.deploy(ethers.ZeroAddress, admin.address)
      ).to.be.revertedWithCustomError(EscrowMgr, "InvalidAddress");
      await expect(
        EscrowMgr.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(EscrowMgr, "InvalidAddress");
    });
  });

  describe("FR-ESC-01: Escrow Deposit", function () {
    it("shipper deposits exact payment amount in test-ETH", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      const tx = await f.escrowManager.connect(f.shipper).deposit(id, {
        value: f.depositAmount,
      });

      await expect(tx)
        .to.emit(f.escrowManager, "EscrowFunded")
        .withArgs(id, f.shipper.address, f.depositAmount);

      expect(await f.escrowManager.isDeposited(id)).to.be.true;

      const [deposited, eligible, released, refunded, amount] =
        await f.escrowManager.getEscrow(id);
      expect(deposited).to.be.true;
      expect(eligible).to.be.false;
      expect(released).to.be.false;
      expect(refunded).to.be.false;
      expect(amount).to.equal(f.depositAmount);
    });

    it("reverts deposit if caller is not assigned shipper", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      await expect(
        f.escrowManager.connect(f.transporter).deposit(id, { value: f.depositAmount })
      ).to.be.revertedWithCustomError(f.escrowManager, "NotAssigned");
    });

    it("reverts deposit if value does not match paymentAmount", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      const wrongAmount = ethers.parseEther("0.5");
      await expect(
        f.escrowManager.connect(f.shipper).deposit(id, { value: wrongAmount })
      ).to.be.revertedWithCustomError(f.escrowManager, "IncorrectAmount");
    });

    it("reverts duplicate deposit", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      await expect(
        f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount })
      )
        .to.be.revertedWithCustomError(f.escrowManager, "AlreadyDeposited")
        .withArgs(id);
    });

    it("blocks startTransit if paymentAmount > 0 and escrow not deposited", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);

      // Attempt startTransit without funding escrow
      await expect(
        f.trackingManager.connect(f.transporter).startTransit(id, "Chennai Hub")
      )
        .to.be.revertedWithCustomError(f.shipmentRegistry, "EscrowRequired")
        .withArgs(id);
    });
  });

  describe("FR-ESC-02 & FR-ESC-03: Eligibility & Release Payment", function () {
    it("full happy path: deposit → accept → transit → arrive → deliver → complete → release", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      // Shipper deposits escrow
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      // Transporter accepts
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);

      // Transporter starts transit (escrow check passes)
      await f.trackingManager.connect(f.transporter).startTransit(id, "Chennai Central");

      // Transporter confirms arrival
      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Kolkata Hub");

      // Receiver confirms delivery (Good condition = 1)
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 1);

      // Receiver accepts delivery (marks escrow eligible)
      const acceptTx = await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);
      await expect(acceptTx)
        .to.emit(f.escrowManager, "PaymentEligible")
        .withArgs(id);

      const [, eligible] = await f.escrowManager.getEscrow(id);
      expect(eligible).to.be.true;

      // Transporter pulls payment
      const initialTransporterBal = await ethers.provider.getBalance(f.transporter.address);

      const releaseTx = await f.escrowManager.connect(f.transporter).releasePayment(id);
      const receipt = await releaseTx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      await expect(releaseTx)
        .to.emit(f.escrowManager, "PaymentReleased")
        .withArgs(id, f.transporter.address, f.depositAmount);

      const finalTransporterBal = await ethers.provider.getBalance(f.transporter.address);
      expect(finalTransporterBal).to.equal(
        initialTransporterBal + f.depositAmount - gasUsed
      );

      // Escrow state verified
      const [, , released, , remainingAmount] = await f.escrowManager.getEscrow(id);
      expect(released).to.be.true;
      expect(remainingAmount).to.equal(0n);
    });

    it("reverts releasePayment if not eligible", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      await expect(
        f.escrowManager.connect(f.transporter).releasePayment(id)
      )
        .to.be.revertedWithCustomError(f.escrowManager, "NotEligible")
        .withArgs(id);
    });

    it("reverts second release (once-only enforcement)", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Origin");
      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Dest");
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 1);
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      await f.escrowManager.connect(f.transporter).releasePayment(id);

      await expect(
        f.escrowManager.connect(f.transporter).releasePayment(id)
      )
        .to.be.revertedWithCustomError(f.escrowManager, "AlreadyReleased")
        .withArgs(id);
    });

    it("reverts releasePayment if caller is not transporter", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(id);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Origin");
      await f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Dest");
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 1);
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      await expect(
        f.escrowManager.connect(f.shipper).releasePayment(id)
      ).to.be.revertedWithCustomError(f.escrowManager, "NotAssigned");
    });

    it("reverts markEligible if called by anyone other than ShipmentRegistry", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      await expect(
        f.escrowManager.connect(f.admin).markEligible(id)
      ).to.be.revertedWithCustomError(f.escrowManager, "OnlyManager");
    });
  });

  describe("FR-ESC-04: Escrow Refund", function () {
    it("shipper pulls refund when transporter rejects shipment", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      // Transporter rejects
      await f.shipmentRegistry.connect(f.transporter).rejectShipment(id);

      const initialShipperBal = await ethers.provider.getBalance(f.shipper.address);

      const refundTx = await f.escrowManager.connect(f.shipper).refund(id);
      const receipt = await refundTx.wait();
      const gasUsed = receipt.gasUsed * receipt.gasPrice;

      await expect(refundTx)
        .to.emit(f.escrowManager, "EscrowRefunded")
        .withArgs(id, f.shipper.address, f.depositAmount);

      const finalShipperBal = await ethers.provider.getBalance(f.shipper.address);
      expect(finalShipperBal).to.equal(
        initialShipperBal + f.depositAmount - gasUsed
      );

      const [, , , refunded, amount] = await f.escrowManager.getEscrow(id);
      expect(refunded).to.be.true;
      expect(amount).to.equal(0n);
    });

    it("shipper pulls refund when shipper cancels shipment", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);

      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.shipper).cancelShipment(id);

      await expect(f.escrowManager.connect(f.shipper).refund(id))
        .to.emit(f.escrowManager, "EscrowRefunded")
        .withArgs(id, f.shipper.address, f.depositAmount);
    });

    it("reverts refund if shipment is not in Rejected or Cancelled state", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      // Still in Created state
      await expect(
        f.escrowManager.connect(f.shipper).refund(id)
      )
        .to.be.revertedWithCustomError(f.escrowManager, "NotEligible")
        .withArgs(id);
    });

    it("reverts duplicate refund", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createShipment(f);
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });
      await f.shipmentRegistry.connect(f.shipper).cancelShipment(id);

      await f.escrowManager.connect(f.shipper).refund(id);

      await expect(
        f.escrowManager.connect(f.shipper).refund(id)
      )
        .to.be.revertedWithCustomError(f.escrowManager, "AlreadyRefunded")
        .withArgs(id);
    });
  });

  describe("Security: Reentrancy Protection", function () {
    it("blocks reentrancy attack on releasePayment via ReentrancyGuard", async function () {
      const f = await loadFixture(fullFixture);

      // Deploy ReentrancyAttacker
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await f.escrowManager.getAddress());
      const attackerAddr = await attacker.getAddress();

      // Register attacker contract as Transporter
      await f.registry.registerParticipant(attackerAddr, 3); // Transporter role

      // Create shipment with attacker as transporter
      const attackInput = {
        ...f.defaultInput,
        externalRef: ethers.encodeBytes32String("REENT-ATTACK-001"),
        transporter: attackerAddr,
      };

      const tx = await f.shipmentRegistry.connect(f.shipper).createShipment(attackInput);
      await tx.wait();
      const id = 1n;

      // Deposit escrow
      await f.escrowManager.connect(f.shipper).deposit(id, { value: f.depositAmount });

      // Attacker executes acceptShipment
      const acceptIface = new ethers.Interface([
        "function acceptShipment(uint256 id)",
      ]);
      const acceptData = acceptIface.encodeFunctionData("acceptShipment", [id]);
      await attacker.execute(await f.shipmentRegistry.getAddress(), 0, acceptData);

      // Start transit through attacker
      const startTransitIface = new ethers.Interface([
        "function startTransit(uint256 id, string location)",
      ]);
      const transitData = startTransitIface.encodeFunctionData("startTransit", [id, "Attack Hub"]);
      await attacker.execute(await f.trackingManager.getAddress(), 0, transitData);

      // Confirm arrival through attacker
      const arrivalIface = new ethers.Interface([
        "function confirmWarehouseArrival(uint256 id, string location)",
      ]);
      const arrivalData = arrivalIface.encodeFunctionData("confirmWarehouseArrival", [id, "Dest Hub"]);
      await attacker.execute(await f.trackingManager.getAddress(), 0, arrivalData);

      // Receiver confirms and accepts delivery
      await f.shipmentRegistry.connect(f.receiver).confirmDelivery(id, 1);
      await f.shipmentRegistry.connect(f.receiver).acceptDelivery(id);

      // Attacker launches reentrant releasePayment attack
      await attacker.attackReleasePayment(id);

      // Verify that reentrancy was attempted but blocked
      expect(await attacker.attackCount()).to.equal(1n);
      expect(await attacker.reentrancySucceeded()).to.be.false;

      // Attacker only got the legitimate payment once
      const attackerBalance = await ethers.provider.getBalance(attackerAddr);
      expect(attackerBalance).to.equal(f.depositAmount);

      // Escrow contract has 0 remaining
      const escrowBalance = await ethers.provider.getBalance(await f.escrowManager.getAddress());
      expect(escrowBalance).to.equal(0n);
    });

    it("blocks reentrancy attack on refund via ReentrancyGuard", async function () {
      const f = await loadFixture(fullFixture);

      // Deploy ReentrancyAttacker
      const Attacker = await ethers.getContractFactory("ReentrancyAttacker");
      const attacker = await Attacker.deploy(await f.escrowManager.getAddress());
      const attackerAddr = await attacker.getAddress();

      // Register attacker contract as Shipper
      await f.registry.registerParticipant(attackerAddr, 2); // Shipper role

      // Create shipment with attacker as shipper
      const createIface = new ethers.Interface([
        "function createShipment((bytes32 externalRef, string productDescription, uint32 quantity, string origin, string destination, int32 destLat, int32 destLon, uint32 geofenceRadiusM, address transporter, address receiver, address warehouse, address inspector, uint64 expectedDelivery, uint256 paymentAmount)) returns (uint256)",
      ]);

      const shipmentInput = {
        ...f.defaultInput,
        externalRef: ethers.encodeBytes32String("REENT-REFUND-001"),
      };

      const createData = createIface.encodeFunctionData("createShipment", [shipmentInput]);
      await attacker.execute(await f.shipmentRegistry.getAddress(), 0, createData);
      const id = 1n;

      // Attacker deposits escrow
      const depositIface = new ethers.Interface([
        "function deposit(uint256 shipmentId)",
      ]);
      const depositData = depositIface.encodeFunctionData("deposit", [id]);
      await attacker.execute(
        await f.escrowManager.getAddress(),
        f.depositAmount,
        depositData,
        { value: f.depositAmount }
      );

      // Transporter rejects shipment (now refundable)
      await f.shipmentRegistry.connect(f.transporter).rejectShipment(id);

      // Attacker launches reentrant refund attack
      await attacker.attackRefund(id);

      // Verify reentrancy was blocked
      expect(await attacker.attackCount()).to.equal(1n);
      expect(await attacker.reentrancySucceeded()).to.be.false;

      // Escrow has 0 remaining
      const escrowBalance = await ethers.provider.getBalance(await f.escrowManager.getAddress());
      expect(escrowBalance).to.equal(0n);
    });
  });
});
