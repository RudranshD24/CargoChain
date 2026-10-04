const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("OracleTracking (FR-ORC-01..03)", function () {
  async function oracleFixture() {
    const [admin, shipper, transporter, receiver, oracle, outsider] =
      await ethers.getSigners();

    // 1. ParticipantRegistry
    const Registry = await ethers.getContractFactory("ParticipantRegistry");
    const registry = await Registry.deploy();

    await registry.registerParticipant(shipper.address, 2);      // Shipper
    await registry.registerParticipant(transporter.address, 3);  // Transporter
    await registry.registerParticipant(receiver.address, 6);     // Receiver
    await registry.registerParticipant(oracle.address, 7);       // Oracle

    // 2. ShipmentRegistry
    const ShipmentReg = await ethers.getContractFactory("ShipmentRegistry");
    const shipmentRegistry = await ShipmentReg.deploy(await registry.getAddress());

    // 3. TrackingManager
    const TrackingMgr = await ethers.getContractFactory("TrackingManager");
    const trackingManager = await TrackingMgr.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());

    // Destination: New Delhi (28.6139° N, 77.2090° E => 28613900, 77209000), radius 1000m
    const shipmentInput = {
      externalRef: ethers.encodeBytes32String("ORACLE-TEST-001"),
      productDescription: "Electronics",
      quantity: 10,
      origin: "Mumbai",
      destination: "Delhi",
      destLat: 28613900,
      destLon: 77209000,
      geofenceRadiusM: 1000,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: ethers.ZeroAddress,
      inspector: ethers.ZeroAddress,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 3,
      paymentAmount: 0n,
    };

    // Create & accept shipment
    const tx = await shipmentRegistry.connect(shipper).createShipment(shipmentInput);
    await tx.wait();
    const shipmentId = 1n;
    await shipmentRegistry.connect(transporter).acceptShipment(shipmentId);

    return {
      registry,
      shipmentRegistry,
      trackingManager,
      admin,
      shipper,
      transporter,
      receiver,
      oracle,
      outsider,
      shipmentId,
      shipmentInput,
      destLat: shipmentInput.destLat,
      destLon: shipmentInput.destLon,
      radiusM: shipmentInput.geofenceRadiusM,
    };
  }

  describe("FR-ORC-01: Restricted Oracle Role & Authorization", function () {
    it("submits oracle update when caller has Role.Oracle", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Warehouse");

      // Intermediate waypoint in microdegrees
      const waypointLat = 20000000;
      const waypointLon = 73000000;
      const uri = "ipfs://QmWaypoint1";

      await expect(
        f.trackingManager
          .connect(f.oracle)
          .submitOracleUpdate(f.shipmentId, waypointLat, waypointLon, 1, uri) // 1 = MilestoneType.InTransit
      )
        .to.emit(f.trackingManager, "OracleUpdateRecorded")
        .withArgs(f.shipmentId, f.oracle.address, waypointLat, waypointLon, 1, false, uri, (val) => val > 0n);

      expect(await f.trackingManager.milestoneCount(f.shipmentId)).to.equal(2n);
    });

    it("reverts if caller does not have Role.Oracle", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Warehouse");

      // Unregistered outsider reverts with InactiveParticipant
      await expect(
        f.trackingManager
          .connect(f.outsider)
          .submitOracleUpdate(f.shipmentId, 20000000, 73000000, 1, "")
      ).to.be.revertedWithCustomError(f.registry, "InactiveParticipant");

      // Active non-oracle (transporter) reverts with Unauthorized
      await expect(
        f.trackingManager
          .connect(f.transporter)
          .submitOracleUpdate(f.shipmentId, 20000000, 73000000, 1, "")
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");
    });

    it("allows Oracle account to report shipment delay", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Warehouse");

      await expect(f.trackingManager.connect(f.oracle).markDelayed(f.shipmentId))
        .to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(f.shipmentId, 2, 3, await f.trackingManager.getAddress()); // InTransit(2) -> Delayed(3)

      expect(await f.shipmentRegistry.statusOf(f.shipmentId)).to.equal(3); // Delayed
    });
  });

  describe("FR-ORC-02 & FR-ORC-03: Geofence Validation and Arrival Check", function () {
    it("records InTransit milestone outside geofence without reverting (deviated route)", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Hub");

      // Far away waypoint (e.g. 100km away)
      const farLat = f.destLat + 500000;
      const farLon = f.destLon + 500000;

      await expect(
        f.trackingManager
          .connect(f.oracle)
          .submitOracleUpdate(f.shipmentId, farLat, farLon, 1, "ipfs://QmDeviated")
      )
        .to.emit(f.trackingManager, "OracleUpdateRecorded")
        .withArgs(f.shipmentId, f.oracle.address, farLat, farLon, 1, false, "ipfs://QmDeviated", (val) => val > 0n);

      // Status remains InTransit
      expect(await f.shipmentRegistry.statusOf(f.shipmentId)).to.equal(2);
    });

    it("reverts Arrived milestone if outside geofence radius", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Hub");

      // 5km away from destination (exceeds 1000m radius)
      // 1m ~ 9 microdegrees; 5000m ~ 45000 microdegrees
      const outsideLat = f.destLat + 50000;
      const outsideLon = f.destLon + 50000;

      await expect(
        f.trackingManager
          .connect(f.oracle)
          .submitOracleUpdate(f.shipmentId, outsideLat, outsideLon, 3, "ipfs://QmArrivedOutside") // 3 = Arrived
      ).to.be.revertedWithCustomError(f.trackingManager, "OutsideGeofence");
    });

    it("accepts Arrived milestone when within geofence and transitions status to Arrived", async function () {
      const f = await loadFixture(oracleFixture);
      await f.trackingManager.connect(f.transporter).startTransit(f.shipmentId, "Mumbai Hub");

      // Inside geofence: within ~100m of destination
      const insideLat = f.destLat + 200;
      const insideLon = f.destLon + 200;

      await expect(
        f.trackingManager
          .connect(f.oracle)
          .submitOracleUpdate(f.shipmentId, insideLat, insideLon, 3, "ipfs://QmArrivedInside")
      )
        .to.emit(f.shipmentRegistry, "StatusChanged")
        .withArgs(f.shipmentId, 2, 4, await f.trackingManager.getAddress()) // 2 = InTransit, 4 = Arrived
        .and.to.emit(f.trackingManager, "OracleUpdateRecorded")
        .withArgs(f.shipmentId, f.oracle.address, insideLat, insideLon, 3, true, "ipfs://QmArrivedInside", (val) => val > 0n);

      expect(await f.shipmentRegistry.statusOf(f.shipmentId)).to.equal(4); // Arrived
    });

    it("evaluates exact boundary, just-outside, and negative coordinate geofences via checkGeofence", async function () {
      const f = await loadFixture(oracleFixture);
      const radiusM = 1000;
      const allowedMicro = radiusM * 9; // 9000 microdegrees

      // Exactly on boundary (distSq == allowedMicro^2)
      const onBoundary = await f.trackingManager.checkGeofence(
        f.destLat + allowedMicro,
        f.destLon,
        f.destLat,
        f.destLon,
        radiusM
      );
      expect(onBoundary).to.be.true;

      // Just outside boundary (distSq > allowedMicro^2)
      const justOutside = await f.trackingManager.checkGeofence(
        f.destLat + allowedMicro + 1,
        f.destLon,
        f.destLat,
        f.destLon,
        radiusM
      );
      expect(justOutside).to.be.false;

      // Negative coordinates (Southern / Western hemisphere)
      const negDestLat = -33868800; // -33.8688° S
      const negDestLon = -70669300; // -70.6693° W
      const negInside = await f.trackingManager.checkGeofence(
        negDestLat + 500,
        negDestLon - 500,
        negDestLat,
        negDestLon,
        radiusM
      );
      expect(negInside).to.be.true;
    });

    it("verifies Oracle account cannot perform non-Oracle sensitive operations", async function () {
      const f = await loadFixture(oracleFixture);

      // 1. Oracle cannot create shipments (Shipper role required)
      const input = { ...f.shipmentInput, externalRef: ethers.encodeBytes32String("ORC-MALICIOUS-01") };
      await expect(
        f.shipmentRegistry.connect(f.oracle).createShipment(input)
      ).to.be.revertedWithCustomError(f.registry, "Unauthorized");

      // 2. Oracle cannot transfer custody
      await expect(
        f.trackingManager.connect(f.oracle).transferCustody(f.shipmentId, f.receiver.address)
      ).to.be.revertedWithCustomError(f.trackingManager, "NotCustodian");
    });
  });
});
