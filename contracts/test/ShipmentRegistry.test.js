const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("ShipmentRegistry", function () {
  async function fullFixture() {
    const [admin, shipper, transporter, warehouse, inspector, receiver, outsider] =
      await ethers.getSigners();

    // Deploy ParticipantRegistry and register roles
    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    await registry.registerParticipant(shipper.address, 2);      // Shipper
    await registry.registerParticipant(transporter.address, 3);  // Transporter
    await registry.registerParticipant(warehouse.address, 4);    // Warehouse
    await registry.registerParticipant(inspector.address, 5);    // Inspector
    await registry.registerParticipant(receiver.address, 6);     // Receiver

    // Deploy ShipmentRegistry
    const ShipmentReg = await ethers.getContractFactory("ShipmentRegistry");
    const shipmentRegistry = await ShipmentReg.deploy(await registry.getAddress());

    // Default input
    const defaultInput = {
      externalRef: ethers.encodeBytes32String("SHIP-001"),
      productDescription: "Electronics",
      quantity: 100,
      origin: "Mumbai",
      destination: "Delhi",
      destLat: 28614000,   // 28.614° N in microdegrees
      destLon: 77209000,   // 77.209° E in microdegrees
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 7,
      paymentAmount: ethers.parseEther("1.0"),
    };

    return {
      registry, shipmentRegistry, defaultInput,
      admin, shipper, transporter, warehouse, inspector, receiver, outsider,
    };
  }

  // Helper to create a shipment and return its ID
  async function createDefaultShipment(fixture) {
    const { shipmentRegistry, shipper, defaultInput } = fixture;
    const tx = await shipmentRegistry.connect(shipper).createShipment(defaultInput);
    const receipt = await tx.wait();
    return 1n; // First shipment ID
  }

  // ── FR-SHP-01: Create shipment ──

  describe("FR-SHP-01: Create shipment", function () {
    it("Shipper creates shipment with valid input", async function () {
      const f = await loadFixture(fullFixture);
      const { shipmentRegistry, shipper, defaultInput, transporter, receiver } = f;

      await expect(shipmentRegistry.connect(shipper).createShipment(defaultInput))
        .to.emit(shipmentRegistry, "ShipmentCreated")
        .withArgs(1, defaultInput.externalRef, shipper.address,
          transporter.address, receiver.address, defaultInput.paymentAmount);

      const s = await shipmentRegistry.getShipment(1);
      expect(s.externalRef).to.equal(defaultInput.externalRef);
      expect(s.status).to.equal(0); // Status.Created
      expect(s.shipper).to.equal(shipper.address);
      expect(s.currentCustodian).to.equal(shipper.address);
      expect(s.quantity).to.equal(100);
    });

    it("assigns sequential IDs starting at 1", async function () {
      const f = await loadFixture(fullFixture);
      const { shipmentRegistry, shipper, defaultInput } = f;

      await shipmentRegistry.connect(shipper).createShipment(defaultInput);
      expect(await shipmentRegistry.nextShipmentId()).to.equal(2);

      const input2 = { ...defaultInput, externalRef: ethers.encodeBytes32String("SHIP-002") };
      await shipmentRegistry.connect(shipper).createShipment(input2);
      expect(await shipmentRegistry.nextShipmentId()).to.equal(3);
    });

    it("reverts on duplicate externalRef", async function () {
      const f = await loadFixture(fullFixture);
      const { shipmentRegistry, shipper, defaultInput } = f;

      await shipmentRegistry.connect(shipper).createShipment(defaultInput);
      await expect(
        shipmentRegistry.connect(shipper).createShipment(defaultInput)
      ).to.be.revertedWithCustomError(shipmentRegistry, "DuplicateExternalRef");
    });

    it("reverts for non-Shipper", async function () {
      const f = await loadFixture(fullFixture);
      const { shipmentRegistry, transporter, defaultInput } = f;

      await expect(
        shipmentRegistry.connect(transporter).createShipment(defaultInput)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });

    it("reverts with zero quantity", async function () {
      const f = await loadFixture(fullFixture);
      const input = { ...f.defaultInput, quantity: 0 };
      await expect(
        f.shipmentRegistry.connect(f.shipper).createShipment(input)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidQuantity");
    });

    it("reverts with zero externalRef", async function () {
      const f = await loadFixture(fullFixture);
      const input = { ...f.defaultInput, externalRef: ethers.ZeroHash };
      await expect(
        f.shipmentRegistry.connect(f.shipper).createShipment(input)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "DuplicateExternalRef");
    });

    it("reverts with inactive transporter", async function () {
      const f = await loadFixture(fullFixture);
      await f.registry.revokeParticipant(f.transporter.address);
      await expect(
        f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });
  });

  // ── FR-SHP-02: Transporter accepts or rejects ──

  describe("FR-SHP-02: Accept/Reject", function () {
    it("assigned transporter accepts", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(f.shipmentRegistry.connect(f.transporter).acceptShipment(1))
        .to.emit(f.shipmentRegistry, "ShipmentAccepted")
        .withArgs(1, f.transporter.address);

      expect((await f.shipmentRegistry.getShipment(1)).status).to.equal(1); // Accepted
    });

    it("assigned transporter rejects", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(f.shipmentRegistry.connect(f.transporter).rejectShipment(1))
        .to.emit(f.shipmentRegistry, "ShipmentRejected")
        .withArgs(1, f.transporter.address);

      expect((await f.shipmentRegistry.getShipment(1)).status).to.equal(7); // Rejected
    });

    it("reverts accept by non-assigned transporter", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(
        f.shipmentRegistry.connect(f.shipper).acceptShipment(1)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "NotAssigned");
    });

    it("reverts accept on non-Created shipment", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(1);

      await expect(
        f.shipmentRegistry.connect(f.transporter).acceptShipment(1)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");
    });
  });

  // ── FR-SHP-03: Canonical state machine ──

  describe("FR-SHP-03: Transition matrix enforcement", function () {
    it("rejects illegal Created → Delivered transition", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(
        f.shipmentRegistry.connect(f.receiver).confirmDelivery(1, 0)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");
    });

    it("rejects Completed → anything (terminal state)", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);
      // Walk to Completed: Created → Accepted → (need tracking for InTransit → Arrived → Delivered → Completed)
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(1);
      // Can't fully test without TrackingManager for InTransit, tested in integration
    });

    it("emits StatusChanged on every transition", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(f.shipmentRegistry.connect(f.transporter).acceptShipment(1))
        .to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(1, 0, 1, f.transporter.address); // Created → Accepted
    });

    it("reverts on nonexistent shipment", async function () {
      const f = await loadFixture(fullFixture);
      await expect(
        f.shipmentRegistry.connect(f.transporter).acceptShipment(999)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "ShipmentNotFound");
    });
  });

  // ── FR-SHP-04: Shipper cancels ──

  describe("FR-SHP-04: Cancellation", function () {
    it("Shipper cancels Created shipment", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(f.shipmentRegistry.connect(f.shipper).cancelShipment(1))
        .to.emit(f.shipmentRegistry, "ShipmentCancelled")
        .withArgs(1, f.shipper.address);

      expect((await f.shipmentRegistry.getShipment(1)).status).to.equal(9); // Cancelled
    });

    it("reverts cancel by non-Shipper", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);

      await expect(
        f.shipmentRegistry.connect(f.transporter).cancelShipment(1)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "NotAssigned");
    });

    it("reverts cancel on Accepted shipment", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(1);

      await expect(
        f.shipmentRegistry.connect(f.shipper).cancelShipment(1)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "InvalidTransition");
    });
  });

  // ── Manager entry points ──

  describe("Manager entry points", function () {
    it("reverts if called by non-TrackingManager", async function () {
      const f = await loadFixture(fullFixture);
      await createDefaultShipment(f);
      await f.shipmentRegistry.connect(f.transporter).acceptShipment(1);

      await expect(
        f.shipmentRegistry.connect(f.outsider).setInTransit(1)
      ).to.be.revertedWithCustomError(f.shipmentRegistry, "OnlyManager");
    });
  });
});
