const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("TrackingManager", function () {
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

    // Link TrackingManager in ShipmentRegistry
    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());

    // Default shipment input (paymentAmount = 0 so no escrow check needed for tracking tests)
    const defaultInput = {
      externalRef: ethers.encodeBytes32String("TRACK-001"),
      productDescription: "Vaccines",
      quantity: 50,
      origin: "Pune",
      destination: "Delhi",
      destLat: 28614000,
      destLon: 77209000,
      geofenceRadiusM: 500,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 5,
      paymentAmount: 0n,
    };

    return {
      registry,
      shipmentRegistry,
      trackingManager,
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

  async function createAndAcceptShipment(f) {
    const tx = await f.shipmentRegistry.connect(f.shipper).createShipment(f.defaultInput);
    await tx.wait();
    await f.shipmentRegistry.connect(f.transporter).acceptShipment(1n);
    return 1n;
  }

  describe("Constructor & Initialization", function () {
    it("deploys with correct registry addresses", async function () {
      const f = await loadFixture(fullFixture);
      expect(await f.trackingManager.registry()).to.equal(await f.registry.getAddress());
      expect(await f.trackingManager.shipmentRegistry()).to.equal(
        await f.shipmentRegistry.getAddress()
      );
    });

    it("reverts on zero address inputs", async function () {
      const TrackingMgr = await ethers.getContractFactory("TrackingManager");
      const [admin] = await ethers.getSigners();
      await expect(
        TrackingMgr.deploy(ethers.ZeroAddress, admin.address)
      ).to.be.revertedWithCustomError(TrackingMgr, "InvalidAddress");
      await expect(
        TrackingMgr.deploy(admin.address, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(TrackingMgr, "InvalidAddress");
    });
  });

  describe("FR-TRK-01: Transit Start & Milestones", function () {
    it("transporter starts transit: updates status, records milestone, transfers custody", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);

      const tx = await f.trackingManager
        .connect(f.transporter)
        .startTransit(id, "Pune Central Hub");

      await expect(tx)
        .to.emit(f.trackingManager, "MilestoneRecorded")
        .withArgs(id, 0, "Pune Central Hub", f.transporter.address, 3); // 0 = Dispatched, 3 = Transporter role

      await expect(tx)
        .to.emit(f.trackingManager, "CustodyTransferred")
        .withArgs(id, f.shipper.address, f.transporter.address);

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(2); // 2 = InTransit
      const shipment = await f.shipmentRegistry.getShipment(id);
      expect(shipment.currentCustodian).to.equal(f.transporter.address);
      expect(await f.trackingManager.milestoneCount(id)).to.equal(1n);
    });

    it("reverts startTransit if caller is not assigned transporter", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);

      await expect(
        f.trackingManager.connect(f.shipper).startTransit(id, "Warehouse")
      ).to.be.revertedWithCustomError(f.trackingManager, "NotAssigned");
    });

    it("involved party records custom milestone", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Origin Hub");

      // Inspector records inspection milestone (1 = InTransit, 5 = Inspector role)
      await expect(
        f.trackingManager
          .connect(f.inspector)
          .recordMilestone(id, 1, "Quality Bay 2", 18520430, 73856743, "Passed cold-chain inspection")
      )
        .to.emit(f.trackingManager, "MilestoneRecorded")
        .withArgs(id, 1, "Quality Bay 2", f.inspector.address, 5);

      expect(await f.trackingManager.milestoneCount(id)).to.equal(2n);
    });

    it("reverts recordMilestone from uninvolved party", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);

      // Inactive/unregistered party
      await expect(
        f.trackingManager
          .connect(f.outsider)
          .recordMilestone(id, 1, "Way Station", 0, 0, "Fake checkpoint")
      ).to.be.revertedWithCustomError(f.registry, "InactiveParticipant");
    });

    it("supports paginated milestone queries", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Station A");
      await f.trackingManager
        .connect(f.transporter)
        .recordMilestone(id, 3, "Station B", 0, 0, "");
      await f.trackingManager
        .connect(f.transporter)
        .recordMilestone(id, 3, "Station C", 0, 0, "");

      const page1 = await f.trackingManager.getMilestones(id, 0, 2);
      expect(page1.length).to.equal(2);
      expect(page1[0].location).to.equal("Station A");
      expect(page1[1].location).to.equal("Station B");

      const page2 = await f.trackingManager.getMilestones(id, 2, 2);
      expect(page2.length).to.equal(1);
      expect(page2[0].location).to.equal("Station C");

      const emptyPage = await f.trackingManager.getMilestones(id, 10, 5);
      expect(emptyPage.length).to.equal(0);
    });
  });

  describe("FR-TRK-02: Custody Transfers", function () {
    it("current custodian transfers custody to another active participant", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      // Current custodian is transporter
      await expect(
        f.trackingManager.connect(f.transporter).transferCustody(id, f.warehouse.address)
      )
        .to.emit(f.trackingManager, "CustodyTransferred")
        .withArgs(id, f.transporter.address, f.warehouse.address);

      const shipment = await f.shipmentRegistry.getShipment(id);
      expect(shipment.currentCustodian).to.equal(f.warehouse.address);
    });

    it("reverts transferCustody if caller is not current custodian", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await expect(
        f.trackingManager.connect(f.shipper).transferCustody(id, f.receiver.address)
      ).to.be.revertedWithCustomError(f.trackingManager, "NotCustodian");
    });

    it("reverts transferCustody to zero address or inactive participant", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await expect(
        f.trackingManager.connect(f.transporter).transferCustody(id, ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(f.trackingManager, "InvalidAddress");

      await expect(
        f.trackingManager.connect(f.transporter).transferCustody(id, f.outsider.address)
      ).to.be.revertedWithCustomError(f.registry, "InactiveParticipant");
    });
  });

  describe("FR-TRK-03: Warehouse Arrival & Delay Handling", function () {
    it("confirms warehouse arrival and sets status Arrived", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      // Transporter confirms arrival at destination warehouse
      await expect(
        f.trackingManager.connect(f.transporter).confirmWarehouseArrival(id, "Delhi Central Hub")
      )
        .to.emit(f.trackingManager, "MilestoneRecorded")
        .withArgs(id, 2, "Delhi Central Hub", f.transporter.address, 3); // 2 = WarehouseArrival

      expect(await f.shipmentRegistry.statusOf(id)).to.equal(4); // 4 = Arrived
    });

    it("warehouse confirms arrival and takes custody", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await expect(
        f.trackingManager.connect(f.warehouse).confirmWarehouseArrival(id, "Delhi Warehouse Bay 1")
      )
        .to.emit(f.trackingManager, "CustodyTransferred")
        .withArgs(id, f.transporter.address, f.warehouse.address);

      const shipment = await f.shipmentRegistry.getShipment(id);
      expect(shipment.currentCustodian).to.equal(f.warehouse.address);
      expect(await f.shipmentRegistry.statusOf(id)).to.equal(4);
    });

    it("reverts confirmWarehouseArrival for unassigned party", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await expect(
        f.trackingManager.connect(f.shipper).confirmWarehouseArrival(id, "Hub")
      ).to.be.revertedWithCustomError(f.trackingManager, "NotAssigned");
    });

    it("transporter marks delay and resumes transit", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      // Mark delayed
      await f.trackingManager.connect(f.transporter).markDelayed(id);
      expect(await f.shipmentRegistry.statusOf(id)).to.equal(3); // 3 = Delayed

      // Resume transit
      await f.trackingManager.connect(f.transporter).resumeTransit(id);
      expect(await f.shipmentRegistry.statusOf(id)).to.equal(2); // 2 = InTransit
    });

    it("admin can mark delayed", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await f.trackingManager.connect(f.admin).markDelayed(id);
      expect(await f.shipmentRegistry.statusOf(id)).to.equal(3);
    });

    it("reverts markDelayed from non-transporter non-admin", async function () {
      const f = await loadFixture(fullFixture);
      const id = await createAndAcceptShipment(f);
      await f.trackingManager.connect(f.transporter).startTransit(id, "Hub");

      await expect(
        f.trackingManager.connect(f.shipper).markDelayed(id)
      ).to.be.revertedWithCustomError(f.trackingManager, "NotAssigned");
    });
  });
});
