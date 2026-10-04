const { expect } = require("chai");
const { ethers } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

describe("CargoChain End-to-End Lifecycle", function () {
  async function fullDeploymentFixture() {
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

    // 4. DocumentRegistry
    const DocReg = await ethers.getContractFactory("DocumentRegistry");
    const documentRegistry = await DocReg.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // 5. EscrowManager
    const EscrowMgr = await ethers.getContractFactory("EscrowManager");
    const escrowManager = await EscrowMgr.deploy(
      await registry.getAddress(),
      await shipmentRegistry.getAddress()
    );

    // Link managers in ShipmentRegistry
    await shipmentRegistry.setTrackingManager(await trackingManager.getAddress());
    await shipmentRegistry.setEscrowManager(await escrowManager.getAddress());

    const paymentAmount = ethers.parseEther("2.5");

    const shipmentInput = {
      externalRef: ethers.encodeBytes32String("E2E-SHIP-999"),
      productDescription: "Temperature-Sensitive Pharmaceuticals",
      quantity: 500,
      origin: "Mumbai Warehouse A",
      destination: "Delhi Medical Store C",
      destLat: 28613939,
      destLon: 77209021,
      geofenceRadiusM: 500,
      transporter: transporter.address,
      receiver: receiver.address,
      warehouse: warehouse.address,
      inspector: inspector.address,
      expectedDelivery: Math.floor(Date.now() / 1000) + 86400 * 5,
      paymentAmount: paymentAmount,
    };

    return {
      registry,
      shipmentRegistry,
      trackingManager,
      documentRegistry,
      escrowManager,
      paymentAmount,
      shipmentInput,
      admin,
      shipper,
      transporter,
      warehouse,
      inspector,
      receiver,
      outsider,
    };
  }

  it("completes full 10-stage lifecycle across all 5 contracts", async function () {
    const f = await loadFixture(fullDeploymentFixture);

    // Stage 1: Shipper creates shipment
    const createTx = await f.shipmentRegistry.connect(f.shipper).createShipment(f.shipmentInput);
    await expect(createTx)
      .to.emit(f.shipmentRegistry, "ShipmentCreated")
      .withArgs(
        1n,
        f.shipmentInput.externalRef,
        f.shipper.address,
        f.transporter.address,
        f.receiver.address,
        f.paymentAmount
      );

    const shipmentId = 1n;
    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(0); // Created
    let s = await f.shipmentRegistry.getShipment(shipmentId);
    expect(s.currentCustodian).to.equal(f.shipper.address);

    // Stage 2: Shipper anchors Bill of Lading on DocumentRegistry
    const bolHash = ethers.keccak256(ethers.toUtf8Bytes("Bill of Lading: Batch 500 Pharma"));
    const bolCid = "QmPharmaBOLHashCID123456789";
    await f.documentRegistry
      .connect(f.shipper)
      .registerDocument(shipmentId, 1, bolHash, bolCid); // 1 = BillOfLading

    // Stage 3: Shipper funds test-ETH Escrow
    await expect(
      f.escrowManager.connect(f.shipper).deposit(shipmentId, { value: f.paymentAmount })
    )
      .to.emit(f.escrowManager, "EscrowFunded")
      .withArgs(shipmentId, f.shipper.address, f.paymentAmount);

    // Stage 4: Transporter accepts shipment
    await expect(f.shipmentRegistry.connect(f.transporter).acceptShipment(shipmentId))
      .to.emit(f.shipmentRegistry, "ShipmentAccepted")
      .withArgs(shipmentId, f.transporter.address);
    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(1); // Accepted

    // Stage 5: Transporter starts transit (requires escrow funded)
    await expect(
      f.trackingManager
        .connect(f.transporter)
        .startTransit(shipmentId, "Mumbai Warehouse A - Bay 3")
    )
      .to.emit(f.trackingManager, "CustodyTransferred")
      .withArgs(shipmentId, f.shipper.address, f.transporter.address);

    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(2); // InTransit
    s = await f.shipmentRegistry.getShipment(shipmentId);
    expect(s.currentCustodian).to.equal(f.transporter.address);

    // Stage 6: En-route milestones & inspection
    // 6a: Checkpoint milestone (1 = InTransit)
    await f.trackingManager
      .connect(f.transporter)
      .recordMilestone(shipmentId, 1, "Surat Highway Toll", 21170240, 72831060, "On schedule");

    // 6b: Cold-chain inspection certificate anchored (3 = InspectionCertificate)
    const certHash = ethers.keccak256(ethers.toUtf8Bytes("Passed 2-8 deg C temp inspection"));
    const certCid = "QmPharmaInspectionCertCID";
    await f.documentRegistry
      .connect(f.inspector)
      .registerDocument(shipmentId, 3, certHash, certCid);

    // 6c: Inspector records inspection milestone (1 = InTransit)
    await f.trackingManager
      .connect(f.inspector)
      .recordMilestone(shipmentId, 1, "Ahmedabad Inspection Post", 23022505, 72571362, "All vials intact");

    // 6d: Delay encountered and resolved
    await f.trackingManager.connect(f.transporter).markDelayed(shipmentId);
    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(3); // Delayed

    await f.trackingManager.connect(f.transporter).resumeTransit(shipmentId);
    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(2); // InTransit

    // Stage 7: Warehouse arrival confirmed
    await expect(
      f.trackingManager
        .connect(f.warehouse)
        .confirmWarehouseArrival(shipmentId, "Delhi Medical Storage Bay 1")
    )
      .to.emit(f.trackingManager, "CustodyTransferred")
      .withArgs(shipmentId, f.transporter.address, f.warehouse.address);

    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(4); // Arrived
    s = await f.shipmentRegistry.getShipment(shipmentId);
    expect(s.currentCustodian).to.equal(f.warehouse.address);

    // Stage 8: Receiver confirms delivery with Condition.Intact (0 = Intact)
    await expect(
      f.shipmentRegistry.connect(f.receiver).confirmDelivery(shipmentId, 0)
    )
      .to.emit(f.shipmentRegistry, "DeliveryConfirmed")
      .withArgs(shipmentId, f.receiver.address, 0);

    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(5); // Delivered

    // Stage 9: Receiver verifies document integrity before accepting delivery
    const [bolMatch] = await f.documentRegistry
      .connect(f.receiver)
      .verifyDocument.staticCall(shipmentId, 0, bolHash);
    expect(bolMatch).to.be.true;

    const [certMatch] = await f.documentRegistry
      .connect(f.receiver)
      .verifyDocument.staticCall(shipmentId, 1, certHash);
    expect(certMatch).to.be.true;

    // Stage 10: Receiver accepts delivery -> triggers Escrow eligibility
    await expect(
      f.shipmentRegistry.connect(f.receiver).acceptDelivery(shipmentId)
    )
      .to.emit(f.escrowManager, "PaymentEligible")
      .withArgs(shipmentId);

    expect(await f.shipmentRegistry.statusOf(shipmentId)).to.equal(6); // Completed (terminal)

    // Stage 11: Transporter pulls payment
    const initialTransporterBal = await ethers.provider.getBalance(f.transporter.address);

    const releaseTx = await f.escrowManager.connect(f.transporter).releasePayment(shipmentId);
    const receipt = await releaseTx.wait();
    const gasCost = receipt.gasUsed * receipt.gasPrice;

    await expect(releaseTx)
      .to.emit(f.escrowManager, "PaymentReleased")
      .withArgs(shipmentId, f.transporter.address, f.paymentAmount);

    const finalTransporterBal = await ethers.provider.getBalance(f.transporter.address);
    expect(finalTransporterBal).to.equal(
      initialTransporterBal + f.paymentAmount - gasCost
    );

    // Verify final state integrity
    expect(await f.trackingManager.milestoneCount(shipmentId)).to.equal(4n); // Dispatched, Surat checkpoint, Inspection, Warehouse arrival
    expect(await f.documentRegistry.documentCount(shipmentId)).to.equal(2n);

    const [deposited, eligible, released, refunded, amount] =
      await f.escrowManager.getEscrow(shipmentId);
    expect(deposited).to.be.true;
    expect(eligible).to.be.true;
    expect(released).to.be.true;
    expect(refunded).to.be.false;
    expect(amount).to.equal(0n);
  });
});
